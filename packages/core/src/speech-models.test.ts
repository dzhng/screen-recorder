import { afterEach, expect, test, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { CatalogError } from "./catalog.js";
import { parakeetModel, SpeechModels, type SpeechModelManifest } from "./speech-models.js";

const cleanups: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const contents: Record<string, Buffer> = {
  "Model.mlmodelc/weights/weight.bin": Buffer.alloc(256 * 1024, "weights"),
  "vocab.json": Buffer.from('{"0":"um"}'),
};
const pin = (path: string, body: Buffer) => ({
  path,
  bytes: body.length,
  sha256: createHash("sha256").update(body).digest("hex"),
});
const manifest: SpeechModelManifest = {
  name: "tiny",
  repo: "test/tiny-coreml",
  revision: "r1",
  folderName: "tiny-model",
  engine: {
    runtime: "TinyRuntime",
    runtimeVersion: "1.0.0",
    runtimeRevision: "c".repeat(40),
    decoder: "tiny-decoder",
  },
  files: Object.entries(contents).map(([path, body]) => pin(path, body)),
};
type Handler = (path: string, response: ServerResponse, request: IncomingMessage) => void;
const serveFile: Handler = (path, response) => {
  const body = contents[path];
  if (!body) return void response.writeHead(404).end();
  response.writeHead(200, { "content-length": body.length }).end(body);
};

async function fixture(handler: Handler = serveFile) {
  const home = await mkdtemp("/tmp/screenrec-speech-models-");
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const prefix = `/${manifest.repo}/resolve/${manifest.revision}/`;
    const path = decodeURIComponent(request.url!.slice(prefix.length));
    handler(path, response, request);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanups.push(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const local: typeof fetch = (input, init) => {
    requests.push(String(input));
    return fetch(String(input).replace("https://huggingface.co", origin), init);
  };
  const open = (network: typeof fetch = local) => new SpeechModels(home, network, manifest);
  const models = join(await realpath(home), "models");
  return {
    home,
    requests,
    open,
    models,
    revision: join(models, "tiny", "r1"),
    staged: () => readdir(join(models, ".staging")),
  };
}
const offline: typeof fetch = () => {
  throw new Error("status and native requests must not use the network");
};
const failure = (code: string, retryable = false) =>
  expect.objectContaining({ code, retryable }) as unknown as CatalogError;
/** Sends the first bytes of a large file, then holds the response open until released. */
function stalling(path: string) {
  const held: ServerResponse[] = [];
  const handler: Handler = (requested, response) => {
    if (requested !== path) return serveFile(requested, response, undefined as never);
    const body = contents[path]!;
    response.writeHead(200, { "content-length": body.length });
    response.write(body.subarray(0, 1024));
    held.push(response);
  };
  return { handler, held };
}

test("prepare installs pinned files whole and reports them for the native request", async () => {
  const { open, requests, models, revision, staged } = await fixture();
  const speech = open();
  expect(speech.status()).toEqual({ state: "absent" });

  await speech.prepare(new AbortController().signal);

  expect(speech.status()).toEqual({ state: "ready" });
  expect(speech.nativeRequest()).toEqual({
    directory: join(revision, "tiny-model"),
    files: manifest.files,
  });
  for (const [path, body] of Object.entries(contents))
    expect(await readFile(join(revision, "tiny-model", path))).toEqual(body);
  expect(JSON.parse(await readFile(join(revision, "receipt.json"), "utf8"))).toMatchObject({
    modelDigest: speech.modelDigest,
  });
  expect(requests.sort()).toEqual([
    "https://huggingface.co/test/tiny-coreml/resolve/r1/Model.mlmodelc/weights/weight.bin",
    "https://huggingface.co/test/tiny-coreml/resolve/r1/vocab.json",
  ]);
  expect(await staged()).toEqual([]);
  expect((await stat(models)).mode & 0o777).toBe(0o700);
});

test("the runtime pinned beside the model is the one the native worker resolves", async () => {
  const resolved = JSON.parse(
    await readFile(new URL("../../../helpers/mac/Package.resolved", import.meta.url), "utf8"),
  ) as { pins: { identity: string; state: { version?: string; revision: string } }[] };
  const fluidAudio = resolved.pins.find((pin) => pin.identity === "fluidaudio");
  expect(fluidAudio?.state).toEqual({
    version: parakeetModel.engine.runtimeVersion,
    revision: parakeetModel.engine.runtimeRevision,
  });
});

test("the model digest names the pinned file list, not the order it is declared in", async () => {
  const { home } = await fixture();
  const digest = new SpeechModels(home, offline, manifest).modelDigest;
  const reordered = { ...manifest, files: [...manifest.files].reverse() };
  expect(new SpeechModels(home, offline, reordered).modelDigest).toBe(digest);
  const repinned = {
    ...manifest,
    files: manifest.files.map((file, index) =>
      index ? file : { ...file, sha256: "0".repeat(64) },
    ),
  };
  expect(new SpeechModels(home, offline, repinned).modelDigest).not.toBe(digest);
});

test("status, native requests and an already prepared model never use the network", async () => {
  const { open } = await fixture();
  expect(open(offline).status()).toEqual({ state: "absent" });
  expect(() => open(offline).nativeRequest()).toThrow(failure("MODEL_NOT_PREPARED", true));
  await open().prepare(new AbortController().signal);

  const restarted = open(offline);
  expect(restarted.status()).toEqual({ state: "ready" });
  await restarted.prepare(new AbortController().signal);
  expect(restarted.nativeRequest().files).toEqual(manifest.files);
});

test("an interrupted download is retryable and leaves no model", async () => {
  const { open, revision, staged } = await fixture((path, response) => {
    const body = contents[path]!;
    response.writeHead(200, { "content-length": body.length });
    response.write(body.subarray(0, body.length / 2), () => response.destroy());
  });
  const speech = open();

  await expect(speech.prepare(new AbortController().signal)).rejects.toEqual(
    failure("MODEL_DOWNLOAD_FAILED", true),
  );

  expect(speech.status()).toMatchObject({
    state: "failed",
    code: "MODEL_DOWNLOAD_FAILED",
    retryable: true,
  });
  await expect(stat(revision)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await staged()).toEqual([]);
});

test("staging left by a process that stopped mid-download is removed on the next start", async () => {
  const { handler, held } = stalling("Model.mlmodelc/weights/weight.bin");
  const { open, revision, staged } = await fixture(handler);
  const controller = new AbortController();
  const preparing = open().prepare(controller.signal);
  cleanups.push(async () => {
    controller.abort();
    await preparing.catch(() => {});
  });
  await vi.waitFor(() => expect(held).toHaveLength(1));
  expect(await staged()).toHaveLength(1);

  const restarted = open(offline);

  expect(await staged()).toEqual([]);
  expect(restarted.status()).toEqual({ state: "absent" });
  await expect(stat(revision)).rejects.toMatchObject({ code: "ENOENT" });
});

test("a file whose bytes differ from its pin is refused", async () => {
  const { open, revision, staged } = await fixture((path, response) => {
    const body = Buffer.from(contents[path]!);
    body[0] = body[0]! ^ 0xff;
    response.writeHead(200).end(body);
  });
  const speech = open();

  await expect(speech.prepare(new AbortController().signal)).rejects.toEqual(
    failure("MODEL_HASH_MISMATCH"),
  );

  expect(speech.status()).toMatchObject({ state: "failed", code: "MODEL_HASH_MISMATCH" });
  await expect(stat(revision)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await staged()).toEqual([]);
});

test("a file longer or shorter than its pin is refused without reading past the pin", async () => {
  const responses: Handler[] = [
    // Never ends: only the size bound can stop this download.
    (path, response) =>
      void response.writeHead(200).write(Buffer.concat([contents[path]!, Buffer.from("x")])),
    (path, response) => void response.writeHead(200).end(contents[path]!.subarray(1)),
  ];
  for (const handler of responses) {
    const { open, revision } = await fixture(handler);
    const speech = open();

    await expect(speech.prepare(new AbortController().signal)).rejects.toEqual(
      failure("MODEL_HASH_MISMATCH"),
    );
    await expect(stat(revision)).rejects.toMatchObject({ code: "ENOENT" });
  }
});

test("a prepared file changed on disk reads as invalid until prepare replaces the install", async () => {
  const { open, requests, revision } = await fixture();
  const speech = open();
  await speech.prepare(new AbortController().signal);
  const vocabulary = join(revision, "tiny-model", "vocab.json");
  await writeFile(vocabulary, '{"0":"uh"}');

  expect(speech.status()).toEqual({ state: "invalid" });
  expect(() => speech.nativeRequest()).toThrow(failure("MODEL_NOT_PREPARED", true));

  await speech.prepare(new AbortController().signal);
  expect(speech.status()).toEqual({ state: "ready" });
  expect(await readFile(vocabulary)).toEqual(contents["vocab.json"]);
  expect(requests).toHaveLength(4);
});

test("an extra file inside the model folder makes the install invalid", async () => {
  const { open, revision } = await fixture();
  const speech = open();
  await speech.prepare(new AbortController().signal);
  await mkdir(join(revision, "tiny-model", "Extra.mlmodelc"));
  await writeFile(join(revision, "tiny-model", "Extra.mlmodelc", "model.mil"), "");

  expect(speech.status()).toEqual({ state: "invalid" });
});

test("concurrent prepares join one download", async () => {
  const { handler, held } = stalling("Model.mlmodelc/weights/weight.bin");
  const { open, requests } = await fixture(handler);
  const speech = open();

  const first = speech.prepare(new AbortController().signal);
  await vi.waitFor(() => expect(held).toHaveLength(1));
  expect(speech.status()).toMatchObject({
    state: "preparing",
    totalBytes: manifest.files.reduce((total, file) => total + file.bytes, 0),
  });
  const second = speech.prepare(new AbortController().signal);
  held[0]!.end(contents["Model.mlmodelc/weights/weight.bin"]!.subarray(1024));

  await Promise.all([first, second]);
  expect(speech.status()).toEqual({ state: "ready" });
  expect(requests.filter((url) => url.endsWith("weight.bin"))).toHaveLength(1);
});

test("a caller that aborts leaves a joined prepare running", async () => {
  const { handler, held } = stalling("Model.mlmodelc/weights/weight.bin");
  const { open } = await fixture(handler);
  const speech = open();
  const leaving = new AbortController();
  const left = speech.prepare(leaving.signal);
  const stayed = speech.prepare(new AbortController().signal);
  await vi.waitFor(() => expect(held).toHaveLength(1));

  leaving.abort(new Error("left"));
  await expect(left).rejects.toThrow("left");
  held[0]!.end(contents["Model.mlmodelc/weights/weight.bin"]!.subarray(1024));

  await stayed;
  expect(speech.status()).toEqual({ state: "ready" });
});

test("abort by every caller stops the download and leaves no model", async () => {
  const { handler, held } = stalling("Model.mlmodelc/weights/weight.bin");
  const { open, revision, staged } = await fixture(handler);
  const speech = open();
  const controller = new AbortController();
  const preparing = speech.prepare(controller.signal);
  await vi.waitFor(() => expect(held).toHaveLength(1));

  controller.abort(new Error("stopped"));

  await expect(preparing).rejects.toThrow("stopped");
  expect(speech.status()).toEqual({ state: "absent" });
  await expect(stat(revision)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await staged()).toEqual([]);
});

test("a models directory that is a link is refused", async () => {
  const { home } = await fixture();
  const elsewhere = join(home, randomUUID());
  await mkdir(elsewhere);
  await symlink(elsewhere, join(home, "models"));

  expect(() => new SpeechModels(home, offline, manifest)).toThrow(failure("MODEL_STORAGE_FAILED"));
});
