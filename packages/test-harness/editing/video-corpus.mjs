import { createHash } from "node:crypto";
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
  selectionRangeSchema,
} from "@yap/composition";
import { readAudioWaveFile } from "@yap/core/audio-wave";

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

/** Freeze original decoder operands; recognizer/picture dispositions remain separate. */
export async function deriveCorpus(directory, sources, selected, native, tool) {
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
      const prior = manifest.cases.find((entry) => entry.id === c.id);
      if (prior) {
        if (
          prior.source.sha256 !== c.source.sha256 ||
          prior.source.streamIndex !== c.source.streamIndex ||
          compare(fromTime(prior.source.range.startUs), fromTime(c.source.range.startUs)) !== 0 ||
          compare(fromTime(prior.source.range.endUs), fromTime(c.source.range.endUs)) !== 0
        )
          refuse("RECIPE_CHANGED", `${c.id}: existing fixture belongs to another source selection`);
        await verifyCorpus(directory, c.id);
        continue;
      }
      const probe = await call("media.probe", { path: source });
      const stream = probe.streams[c.source.streamIndex];
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
        recipe: { operation: "media.sourceAudio", streamId: stream.id, range, tool },
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
export async function verifyCorpus(directory, selected) {
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
    }
    if (c.preservation.status !== "pass")
      refuse("PRESERVATION_UNVERIFIED", `${c.id}: reduction fidelity is not certified`);
    bytes += stat.size;
    reports.push({ id: c.id, sha256: c.derivative.sha256, baseline: c.baseline.state });
  }
  if (bytes > 250 * 1024 * 1024) refuse("CORPUS_BUDGET", "Selected corpus exceeds 250 MiB");
  return { ok: true, bytes, cases: reports };
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
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "node packages/test-harness/editing/video-corpus.mjs verify --fixtures DIRECTORY [--case ID]\nnode packages/test-harness/editing/video-corpus.mjs derive --fixtures DIRECTORY --sources ORIGINAL_DIRECTORY --native ABSOLUTE_EXECUTABLE [--case ID]\nVerify retained media bytes, physical audio samples and exact source-clock mappings. Derivation freezes source decoder samples; ASR/picture quality is reported separately.",
      );
    } else {
      if (positionals.length !== 1 || !values.fixtures) refuse("USAGE", "Read --help");
      if (positionals[0] === "derive") {
        if (!values.sources || !values.native || !isAbsolute(values.native))
          refuse("USAGE", "Derive requires --sources and absolute --native");
        const { mediaWorker } = await import("../../../apps/service/dist/worker.js");
        await deriveCorpus(
          values.fixtures,
          values.sources,
          values.case,
          mediaWorker({ ...process.env, YAP_NATIVE: values.native }),
          { kind: "yap-native", sha256: await sha256(values.native) },
        );
      } else if (positionals[0] !== "verify") refuse("USAGE", "Read --help");
      console.log(JSON.stringify(await verifyCorpus(values.fixtures, values.case)));
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
