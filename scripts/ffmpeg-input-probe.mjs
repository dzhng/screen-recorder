import { compileCliOwner } from "../apps/service/src/cli-owner.fixture.ts";
import { inspectFfmpegInput } from "../apps/service/dist/ffmpeg-input.js";
import { cliWorker, jsonWorker } from "../apps/service/dist/worker.js";
import { copyFile, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { join, isAbsolute } from "node:path";
const [tools, evidence, output, native] = process.argv.slice(2);
if (![tools, evidence, output, native].every((value) => value && isAbsolute(value)))
  throw new Error(
    "Usage: node scripts/ffmpeg-input-probe.mjs /prepared/bin /retained/native-probe-evidence /report.json /frozen/native",
  );
const directory = await mkdtemp("/tmp/yap-input-proof-");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receipts = [];
try {
  const owner = await compileCliOwner(directory);
  for (const name of ["a", "bframes", "timestamp-gap", "orientation"]) {
    const caseDirectory = join(evidence, name);
    const prior = JSON.parse(await readFile(join(caseDirectory, "report.json"), "utf8"));
    const request = JSON.parse(await readFile(join(caseDirectory, "request-1.json"), "utf8"));
    const reply = JSON.parse(await readFile(join(caseDirectory, "reply-1.json"), "utf8"));
    if (request.operation !== "media.probe" || !reply.ok)
      throw new Error("Missing retained native source authority");
    const original = request.params.path;
    if (hash(await readFile(original)) !== prior.sourceSha256)
      throw new Error("Retained source changed");
    let path = original;
    if (name === "a") {
      path = join(directory, "held.mov");
      await copyFile(original, path);
    }
    const caseReceipts = [];
    for (const stream of reply.data.streams.filter(
      (row) => row.kind === "video" || row.kind === "audio",
    )) {
      // A distinct read lease belongs to this inspection and execution pair.
      const file = await open(path, "r");
      try {
        if (name === "a" && stream.kind === "video") {
          await rename(path, join(directory, "retained-original.mov"));
          await writeFile(path, "unadmitted replacement");
        }
        const input = await inspectFfmpegInput(
          { executable: join(tools, "ffprobe"), ownerExecutable: owner },
          { file, metadata: reply.data, streamId: stream.id },
        );
        if (input.originUs !== reply.data.originUs || !isDeepStrictEqual(input.stream, stream))
          throw new Error("FFmpeg replaced native support/timing/geometry authority");
        const result = await cliWorker(
          {
            executable: join(tools, "ffmpeg"),
            ownerExecutable: owner,
            args: [
              "-nostdin",
              "-v",
              "error",
              ...input.args,
              "-map",
              input.map,
              "-t",
              "0.1",
              "-f",
              "null",
              "-",
            ],
          },
          { descriptors: input.descriptors, rewindDescriptors: input.rewindDescriptors },
        );
        if (!result.ok) throw new Error(JSON.stringify({ name, streamId: stream.id, result }));
        caseReceipts.push({
          streamId: stream.id,
          map: input.map,
          originUs: input.originUs,
          nativeSupport: input.stream,
          decoded: true,
        });
      } finally {
        await file.close();
      }
      if (name === "a") path = join(directory, "retained-original.mov");
    }
    receipts.push({
      name,
      source: original,
      sourceSha256: prior.sourceSha256,
      nativeSha256: prior.nativeSha256,
      pathnameSwap: name === "a",
      streams: caseReceipts,
    });
  }
  const nativeSha256 = hash(await readFile(native));
  for (const [extension, codec] of [
    ["caf", "pcm_f32le"],
    ["aac", "aac"],
  ]) {
    const path = join(directory, "family." + extension);
    const created = await cliWorker({
      executable: join(tools, "ffmpeg"),
      ownerExecutable: owner,
      args: [
        "-nostdin",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=duration=0.1:sample_rate=48000",
        "-c:a",
        codec,
        path,
      ],
    });
    if (!created.ok) throw new Error(JSON.stringify(created));
    const authority = await jsonWorker({ executable: native })("media.probe", { path });
    if (!authority.ok) throw new Error(JSON.stringify(authority));
    const stream = authority.data.streams.find((row) => row.kind === "audio");
    const file = await open(path, "r");
    try {
      const input = await inspectFfmpegInput(
        { executable: join(tools, "ffprobe"), ownerExecutable: owner },
        { file, metadata: authority.data, streamId: stream.id },
      );
      if (!isDeepStrictEqual(input.stream, stream))
        throw new Error("Audio family lost native authority");
      const decoded = await cliWorker(
        {
          executable: join(tools, "ffmpeg"),
          ownerExecutable: owner,
          args: [
            "-nostdin",
            "-v",
            "error",
            ...input.args,
            "-map",
            input.map,
            "-frames:a",
            "1",
            "-f",
            "null",
            "-",
          ],
        },
        { descriptors: input.descriptors, rewindDescriptors: input.rewindDescriptors },
      );
      if (!decoded.ok) throw new Error(JSON.stringify(decoded));
      receipts.push({
        name: extension,
        sourceSha256: hash(await readFile(path)),
        nativeSha256,
        fixture: "generated 100ms sine, disposable",
        streams: [
          {
            streamId: stream.id,
            map: input.map,
            originUs: input.originUs,
            nativeSupport: input.stream,
            decoded: true,
          },
        ],
      });
    } finally {
      await file.close();
    }
  }
  const report = {
    ffmpegSha256: hash(await readFile(join(tools, "ffmpeg"))),
    ffprobeSha256: hash(await readFile(join(tools, "ffprobe"))),
    receipts,
    scope:
      "Read-only native authority reuse, retained fd selectors, bounded null decode; no demo edit or user state",
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(
    JSON.stringify({
      output,
      cases: receipts.length,
      streams: receipts.reduce((sum, row) => sum + row.streams.length, 0),
      pathnameSwap: "held original decoded",
    }),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
