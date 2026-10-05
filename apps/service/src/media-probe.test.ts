import { createHash } from "node:crypto";
import { writeSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { afterEach, expect, test } from "vitest";
import { readMediaProbe } from "./media-probe.js";
import type { MediaWorker } from "./worker.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

test.each(["valid", "wrong digest", "wrong size", "invalid JSON"])(
  "probe file delivery validates %s evidence and releases its temporary file",
  async (mode) => {
    const directory = await mkdtemp("/tmp/probe-file-test-");
    directories.push(directory);
    const metadata = {
      originUs: 100001,
      streams: [{ id: "audio:0", segments: [{ empty: true }] }],
    };
    const bytes = Buffer.from(mode === "invalid JSON" ? "{" : JSON.stringify(metadata));
    const worker: MediaWorker = async (_operation, params, options) => {
      const index = Number(String(params.output).split("/").at(-1)) - 3;
      writeSync(options!.descriptors![index]!, bytes, 0, bytes.length, 0);
      return {
        ok: true,
        data: {
          file: params.output,
          bytes: bytes.length + (mode === "wrong size" ? 1 : 0),
          sha256:
            mode === "wrong digest"
              ? "0".repeat(64)
              : createHash("sha256").update(bytes).digest("hex"),
        },
      };
    };
    const result = readMediaProbe(
      worker,
      directory,
      "/dev/fd/3",
      new AbortController().signal,
      [0],
    );
    if (mode === "valid") await expect(result).resolves.toEqual(metadata);
    else
      await expect(result).rejects.toMatchObject({
        code: "INVALID_NATIVE_RESPONSE",
      });
    expect(await readdir(directory)).toEqual([]);
  },
);

test("canceled probe delivery discards its unpublished file", async () => {
  const directory = await mkdtemp("/tmp/probe-file-cancel-");
  directories.push(directory);
  const controller = new AbortController();
  const worker: MediaWorker = async () => {
    controller.abort();
    return {
      ok: false,
      error: {
        code: "CANCELED",
        message: "canceled",
        retryable: true,
        details: {},
      },
    };
  };
  await expect(
    readMediaProbe(worker, directory, "/dev/fd/3", controller.signal, []),
  ).rejects.toMatchObject({ code: "CANCELED" });
  expect(await readdir(directory)).toEqual([]);
});

test("explicit compressed inspection is returned through the existing verified probe file", async () => {
  const directory = await mkdtemp("/tmp/probe-compressed-test-");
  directories.push(directory);
  const inspection = {
    status: "complete",
    packetCount: 3,
    nalTypes: [20],
    configurationNalTypes: [32, 33, 34],
    seiPayloadTypes: [],
    refusals: [],
  };
  const worker: MediaWorker = async (_operation, params, options) => {
    const metadata = {
      originUs: 0,
      streams: [
        {
          id: "track:1",
          kind: "video",
          ...(params.inspectCompressedVideo === true
            ? { compressedVideoInspection: inspection }
            : {}),
        },
      ],
    };
    const bytes = Buffer.from(JSON.stringify(metadata));
    const slot = Number(String(params.output).split("/").at(-1)) - 3;
    writeSync(options!.descriptors![slot]!, bytes, 0, bytes.length, 0);
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  };
  const metadata = await readMediaProbe(
    worker,
    directory,
    "/dev/fd/3",
    new AbortController().signal,
    [0],
    { inspectCompressedVideo: true },
  );
  expect(metadata).toMatchObject({
    streams: [{ compressedVideoInspection: inspection }],
  });
  expect(await readdir(directory)).toEqual([]);
});

test("explicit selected audio inspection survives the same verified probe-file contract", async () => {
  const directory = await mkdtemp("/tmp/probe-decoded-audio-");
  directories.push(directory);
  const inspection = {
    sampleRate: 48000,
    channels: 1,
    frames: 6000,
    runs: [{ startUs: 0, endUs: 125000, frames: 6000 }],
    pcmSha256: "c".repeat(64),
    trimming: "decoder-output-attachment-free",
  };
  const worker: MediaWorker = async (_operation, params, options) => {
    const metadata = {
      originUs: 0,
      streams: [
        {
          id: "track:2",
          kind: "audio",
          ...(params.inspectAudioStreamId === "track:2"
            ? { decodedAudioInspection: inspection }
            : {}),
        },
      ],
    };
    const bytes = Buffer.from(JSON.stringify(metadata));
    const slot = Number(String(params.output).split("/").at(-1)) - 3;
    writeSync(options!.descriptors![slot]!, bytes, 0, bytes.length, 0);
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  };
  const metadata = await readMediaProbe(
    worker,
    directory,
    "/dev/fd/3",
    new AbortController().signal,
    [0],
    { inspectAudioStreamId: "track:2" },
  );
  expect(metadata).toMatchObject({
    streams: [{ id: "track:2", decodedAudioInspection: inspection }],
  });
  expect(await readdir(directory)).toEqual([]);
});
