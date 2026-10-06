import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { isDeepStrictEqual, promisify } from "node:util";
import { createReadStream } from "node:fs";
import { constants } from "node:fs";
import { copyFile, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  fromTime,
  toTime,
  toSignedTime,
  subtract,
  compare,
  rational,
  multiply,
  selectionRangeSchema,
} from "@yap/composition";
import { readAudioWaveFile } from "@yap/core/audio-wave";

const run = promisify(execFile);

export function videoProbe(ffprobe) {
  if (!isAbsolute(ffprobe)) refuse("USAGE", "Video certification requires absolute --ffprobe");
  return async (file) =>
    JSON.parse(
      (
        await run(ffprobe, ["-v", "error", "-show_streams", "-show_frames", "-of", "json", file], {
          timeout: 60000,
          maxBuffer: 8 * 1024 * 1024,
        })
      ).stdout,
    );
}

export async function sha256(file) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest("hex");
}

function refuse(code, message) {
  throw Object.assign(new Error(message), { code });
}

function inside(directory, file) {
  const path = resolve(directory, file);
  const local = relative(resolve(directory), path);
  if (local.startsWith("..") || isAbsolute(local)) refuse("INPUT_PATH", "Fixture leaves its root");
  return path;
}

function verifyVideo(c, range, decoded) {
  const { streams, frames } = decoded;
  const stream = streams?.[0];
  if (streams?.length !== 1 || stream.codec_type !== "video" || !frames?.length)
    refuse("VIDEO_CHANGED", `${c.id}: retained video must contain one decoded video stream`);
  if (
    [stream, ...frames].some(
      (frame) =>
        frame.sample_aspect_ratio !== "1:1" ||
        frame.width !== c.derivative.width ||
        frame.height !== c.derivative.height ||
        Object.entries(c.derivative.color).some(([key, value]) => frame[key] !== value),
    )
  )
    refuse(
      "VIDEO_CHANGED",
      `${c.id}: decoded raster, pixel aspect or color interpretation differs`,
    );
  const [numerator, denominator] = stream.time_base.split("/").map(BigInt);
  const tickUs = rational(numerator * 1000000n, denominator);
  const step = fromTime(c.clock.frameDurationUs);
  if (
    frames.length !== c.derivative.frames ||
    compare(
      subtract(fromTime(range.endUs), fromTime(range.startUs)),
      multiply(step, rational(BigInt(frames.length))),
    ) !== 0 ||
    frames.some(
      (frame, index) =>
        !Number.isSafeInteger(frame.pts) ||
        !Number.isSafeInteger(frame.duration) ||
        compare(
          multiply(tickUs, rational(BigInt(frame.pts))),
          multiply(step, rational(BigInt(index))),
        ) !== 0 ||
        compare(multiply(tickUs, rational(BigInt(frame.duration))), step) !== 0,
    )
  )
    refuse("CLOCK_CHANGED", `${c.id}: decoded frame support differs from the exact source clock`);
}

/** Freeze original decoder operands; recognizer/picture dispositions remain separate. */
export async function deriveCorpus(directory, sources, selected, native, tool, mediaTools = {}) {
  const recipes = JSON.parse(await readFile(join(directory, "recipes.json"), "utf8"));
  const cases = selected ? recipes.cases.filter((c) => c.id === selected) : recipes.cases;
  if (!cases.length) refuse("CASE_MISSING", "No selected corpus case");
  const manifest = JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8").catch((error) => {
      if (error.code === "ENOENT") return '{"cases":[]}';
      throw error;
    }),
  );
  const checked = new Map();
  const scratch = await mkdtemp(join(tmpdir(), "yap-corpus-derive-"));
  const call = async (operation, params) => {
    const result = await native(operation, params, { timeoutMs: 180000 });
    if (!result.ok) refuse(result.error.code, result.error.message);
    return result.data;
  };
  try {
    for (const c of cases) {
      const source = inside(sources, c.source.file);
      if (!checked.has(source)) checked.set(source, await sha256(source));
      if (checked.get(source) !== c.source.sha256)
        refuse("SOURCE_CHANGED", `${c.id}: original hash differs`);
      if (c.derivative?.kind === "video" && !/^[a-f0-9]{64}$/.test(c.recipe.tool?.sha256 ?? ""))
        refuse("TOOL_CHANGED", `${c.id}: video recipe requires a frozen encoder hash`);
      const prior = manifest.cases.find((entry) => entry.id === c.id);
      if (prior) {
        if (c.derivative?.kind === "video") {
          const { sha256: _hash, bytes: _bytes, ...derivative } = prior.derivative;
          if (
            !isDeepStrictEqual(prior.recipe, c.recipe) ||
            !isDeepStrictEqual(prior.clock, c.clock) ||
            !isDeepStrictEqual(derivative, c.derivative)
          )
            refuse("RECIPE_CHANGED", `${c.id}: existing fixture belongs to another video recipe`);
        }
        if (
          prior.source.sha256 !== c.source.sha256 ||
          prior.source.streamIndex !== c.source.streamIndex ||
          compare(fromTime(prior.source.range.startUs), fromTime(c.source.range.startUs)) !== 0 ||
          compare(fromTime(prior.source.range.endUs), fromTime(c.source.range.endUs)) !== 0
        )
          refuse("RECIPE_CHANGED", `${c.id}: existing fixture belongs to another source selection`);
        await inspectCorpus(directory, c.id, mediaTools.ffprobe && videoProbe(mediaTools.ffprobe));
        continue;
      }
      const probe = await call("media.probe", { path: source });
      const stream = probe.streams[c.source.streamIndex];
      if (c.derivative?.kind === "video") {
        if (
          stream?.kind !== "video" ||
          compare(fromTime(c.source.range.startUs), fromTime(stream.startUs)) < 0 ||
          compare(fromTime(c.source.range.endUs), fromTime(stream.endUs)) > 0
        )
          refuse("SOURCE_SUPPORT", `${c.id}: selected video stream/range lacks physical support`);
        if (!mediaTools.ffmpeg || !isAbsolute(mediaTools.ffmpeg) || !mediaTools.ffprobe)
          refuse("USAGE", "Video derive requires absolute --ffmpeg and --ffprobe");
        const encoderHash = await sha256(mediaTools.ffmpeg);
        if (encoderHash !== c.recipe.tool.sha256)
          refuse("TOOL_CHANGED", `${c.id}: prepared encoder differs from frozen recipe`);
        const output = join(scratch, "video.mov");
        await run(
          mediaTools.ffmpeg,
          c.recipe.arguments.map((value) =>
            value === "SOURCE" ? source : value === "OUTPUT" ? output : value,
          ),
          { timeout: 180000, maxBuffer: 1024 * 1024 },
        );
        const decoded = await videoProbe(mediaTools.ffprobe)(output);
        verifyVideo(c, selectionRangeSchema.parse(c.source.range), decoded);
        const stat = await lstat(output);
        const entry = {
          ...c,
          derivative: {
            ...c.derivative,
            sha256: await sha256(output),
            bytes: stat.size,
          },
          recipe: {
            ...c.recipe,
            tool: { ...c.recipe.tool, sha256: encoderHash },
          },
          preservation: {
            status: "unverified",
            basis: "physical raster/clock passed; source-to-derivative visual proof required",
          },
          baseline: {
            state: "unverified",
            reason: "picture behavior requires independent observations",
          },
        };
        await copyFile(output, inside(directory, c.derivative.file), constants.COPYFILE_EXCL);
        manifest.cases.push(entry);
        await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
        await rm(output);
        continue;
      }
      if (stream?.kind !== "audio")
        refuse("SOURCE_STREAM", `${c.id}: selected stream is not audio`);
      const range = selectionRangeSchema.parse(c.source.range);
      const request = {
        source: {
          source,
          streamId: stream.id,
          sourceOffsetUs: toSignedTime(subtract(fromTime(0), fromTime(probe.originUs))),
          available: [{ startUs: stream.startUs, endUs: stream.endUs }],
        },
        range,
        output: join(scratch, "source.wav"),
      };
      const decoded = await call("media.sourceAudio", request);
      if (decoded.unavailable.length)
        refuse("SOURCE_SUPPORT", `${c.id}: selected source has unavailable audio`);
      const physical = readAudioWaveFile(decoded.file);
      const duration = subtract(fromTime(range.endUs), fromTime(range.startUs));
      if (
        compare(
          duration,
          rational(BigInt(physical.frames) * 1000000n, BigInt(physical.sampleRate)),
        ) !== 0
      )
        refuse("CLOCK_CHANGED", `${c.id}: selected duration is not a whole decoded sample range`);
      const replay = await call("media.sourceAudio", {
        source: {
          source: decoded.file,
          streamId: "track:1",
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: toTime(duration) }],
        },
        range: { startUs: 0, endUs: toTime(duration) },
        output: join(scratch, "replay.wav"),
      });
      const replayPhysical = readAudioWaveFile(replay.file);
      const bytes = await readFile(decoded.file),
        replayBytes = await readFile(replay.file);
      if (
        replay.unavailable.length ||
        physical.sampleRate !== replayPhysical.sampleRate ||
        physical.channels !== replayPhysical.channels ||
        physical.frames !== replayPhysical.frames ||
        !bytes
          .subarray(physical.dataOffset, physical.dataOffset + physical.dataBytes)
          .equals(
            replayBytes.subarray(
              replayPhysical.dataOffset,
              replayPhysical.dataOffset + replayPhysical.dataBytes,
            ),
          )
      )
        refuse("PRESERVATION_CHANGED", `${c.id}: retained input changes original decoded samples`);
      const file = c.derivative?.file ?? `${c.id}.wav`;
      const entry = {
        ...c,
        source: { ...c.source, originUs: probe.originUs, stream },
        derivative: {
          file,
          sha256: await sha256(decoded.file),
          bytes: bytes.length,
          kind: "audio",
          sampleRate: physical.sampleRate,
          channels: physical.channels,
          frames: physical.frames,
        },
        clock: {
          sourceAtZeroUs: range.startUs,
          sourceFrames: physical.frames,
          trailingSilenceFrames: 0,
        },
        recipe: {
          operation: "media.sourceAudio",
          streamId: stream.id,
          range,
          tool,
        },
        preservation: {
          status: "pass",
          basis: "retained Float32 re-decode equals original source decoder samples exactly",
          comparedSamples: physical.frames * physical.channels,
        },
        baseline: c.baseline ?? {
          state: "unverified",
          reason: "recognizer behavior requires a separate original/derivative run",
        },
      };
      await copyFile(decoded.file, inside(directory, file), constants.COPYFILE_EXCL);
      manifest.cases.push(entry);
      await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
      await rm(decoded.file);
      await rm(replay.file);
    }
    return manifest;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/** Certification never turns a content-addressed input into a model-quality verdict. */
async function inspectCorpus(directory, selected, probeVideo) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const cases = selected ? manifest.cases.filter((c) => c.id === selected) : manifest.cases;
  if (!cases.length) refuse("CASE_MISSING", "No selected corpus case");
  let bytes = 0;
  const reports = [];
  for (const c of cases) {
    const path = inside(directory, c.derivative.file);
    const stat = await lstat(path).catch(() => null);
    if (!stat?.isFile()) refuse("INPUT_MISSING", `${c.id}: fetch the selected retained input`);
    if (stat.size < 256 && (await readFile(path, "utf8")).startsWith("version https://git-lfs"))
      refuse("MISSING_LFS", `${c.id}: Git LFS pointer has no media bytes`);
    if (stat.size !== c.derivative.bytes || (await sha256(path)) !== c.derivative.sha256)
      refuse("INPUT_CHANGED", `${c.id}: derivative bytes differ`);
    const range = selectionRangeSchema.parse(c.source.range);
    if (compare(fromTime(c.clock.sourceAtZeroUs), fromTime(range.startUs)) !== 0)
      refuse("CLOCK_CHANGED", `${c.id}: source origin differs`);
    if (c.derivative.kind === "audio") {
      const actual = readAudioWaveFile(path);
      if (
        actual.sampleRate !== c.derivative.sampleRate ||
        actual.channels !== c.derivative.channels ||
        actual.frames !== c.derivative.frames
      )
        refuse("SAMPLES_CHANGED", `${c.id}: physical sample dimensions differ`);
      if (
        actual.frames !== c.clock.sourceFrames + c.clock.trailingSilenceFrames ||
        compare(
          subtract(fromTime(range.endUs), fromTime(range.startUs)),
          rational(BigInt(c.clock.sourceFrames) * 1000000n, BigInt(actual.sampleRate)),
        ) !== 0
      )
        refuse("CLOCK_CHANGED", `${c.id}: source support differs from decoded frames`);
      const samples = await readFile(path);
      for (let i = 0; i < actual.frames * actual.channels; i++) {
        const value = samples.readFloatLE(actual.dataOffset + i * 4);
        if (!Number.isFinite(value)) refuse("SAMPLES_CHANGED", `${c.id}: nonfinite audio sample`);
        if (i >= c.clock.sourceFrames * actual.channels && value !== 0)
          refuse("PADDING_CHANGED", `${c.id}: declared silence contains nonzero samples`);
      }
    } else if (c.derivative.kind === "video") {
      if (!probeVideo)
        refuse("VIDEO_PROBE_REQUIRED", `${c.id}: physical frame evidence is required`);
      verifyVideo(c, range, await probeVideo(path));
    } else refuse("INPUT_KIND", `${c.id}: unsupported retained media kind`);
    bytes += stat.size;
    reports.push({
      id: c.id,
      sha256: c.derivative.sha256,
      baseline: c.baseline.state,
      preservation: c.preservation,
    });
  }
  if (bytes > 250 * 1024 * 1024) refuse("CORPUS_BUDGET", "Selected corpus exceeds 250 MiB");
  return { bytes, cases: reports };
}

export async function verifyCorpus(directory, selected, probeVideo) {
  const inspection = await inspectCorpus(directory, selected, probeVideo);
  for (const c of inspection.cases) {
    if (c.preservation.status !== "pass")
      refuse("PRESERVATION_UNVERIFIED", `${c.id}: reduction fidelity is not certified`);
  }
  return {
    ok: true,
    bytes: inspection.bytes,
    cases: inspection.cases.map(({ preservation: _preservation, ...report }) => report),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        fixtures: { type: "string" },
        case: { type: "string" },
        sources: { type: "string" },
        native: { type: "string" },
        ffprobe: { type: "string" },
        ffmpeg: { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "node packages/test-harness/editing/video-corpus.mjs verify --fixtures DIRECTORY [--case ID] [--ffprobe ABSOLUTE_EXECUTABLE]\nnode packages/test-harness/editing/video-corpus.mjs derive --fixtures DIRECTORY --sources ORIGINAL_DIRECTORY --native ABSOLUTE_EXECUTABLE [--case ID] [--ffmpeg ABSOLUTE_EXECUTABLE --ffprobe ABSOLUTE_EXECUTABLE]\nVerify retained media bytes, physical audio samples/video frames and exact source-clock mappings. Derive returns inputs with explicit preservation status; verify separately certifies retained inputs. ASR/picture quality is reported separately.",
      );
    } else {
      if (positionals.length !== 1 || !values.fixtures) refuse("USAGE", "Read --help");
      if (positionals[0] === "derive") {
        if (!values.sources || !values.native || !isAbsolute(values.native))
          refuse("USAGE", "Derive requires --sources and absolute --native");
        const { mediaWorker } = await import("../../../apps/service/dist/worker.js");
        const manifest = await deriveCorpus(
          values.fixtures,
          values.sources,
          values.case,
          mediaWorker({ ...process.env, YAP_NATIVE: values.native }),
          { kind: "yap-native", sha256: await sha256(values.native) },
          { ffmpeg: values.ffmpeg, ffprobe: values.ffprobe },
        );
        console.log(
          JSON.stringify({
            ok: true,
            cases: manifest.cases.filter((c) => !values.case || c.id === values.case),
          }),
        );
      } else if (positionals[0] === "verify") {
        console.log(
          JSON.stringify(
            await verifyCorpus(
              values.fixtures,
              values.case,
              values.ffprobe && videoProbe(values.ffprobe),
            ),
          ),
        );
      } else refuse("USAGE", "Read --help");
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        error: { code: error.code ?? "INVALID_CORPUS", message: error.message },
      }),
    );
    process.exitCode = 1;
  }
}
