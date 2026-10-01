import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { writeSync, fstatSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { callLocal } from "@screenrec/client";
import { CONTROL_FRAME_BYTES, JsonLineStream, controlMessageSchema } from "@screenrec/protocol";
import type { OperationResult } from "@screenrec/protocol";
import { startProjectService } from "./project-service.js";
import type { MediaWorker } from "./worker.js";

export async function captureFixture(
  cleanup: (() => Promise<void>)[],
  home?: string,
  worker?: MediaWorker,
  silentOperation?: string,
) {
  if (!home) {
    home = await mkdtemp("/tmp/project-capture-");
    const root = home;
    cleanup.push(() => rm(root, { recursive: true, force: true }));
  }
  const input = new PassThrough(),
    output = new PassThrough();
  const frames = new JsonLineStream(CONTROL_FRAME_BYTES);
  const reports = new Map<string, (result: OperationResult) => void>();
  const nativeCalls: string[] = [];
  const unanswered = new Map<string, string>();
  let take: { recordingId: string; sourceId: string } | undefined;
  let selection: Record<string, unknown> | null = null;
  let deviceState = "idle";
  let sequence = 0;
  output.on("data", (chunk: Buffer) => {
    for (const frame of frames.push(chunk)) {
      if (!frame.ok) throw frame.error;
      const message = controlMessageSchema.parse(frame.value);
      if (message.event === "result") reports.get(message.response.id!)?.(message.response);
      if (message.event !== "call") continue;
      const { operation, params } = message.request;
      nativeCalls.push(operation);
      if (operation === "capture.start") {
        take = { recordingId: String(params.recordingId), sourceId: String(params.sourceId) };
        selection = {
          source: params.source,
          microphone: params.microphone,
          systemAudio: params.systemAudio,
        };
        sequence = 0;
      }
      const state = ["capture.stop", "capture.cancel"].includes(operation)
        ? "finalizing"
        : operation === "capture.pause"
          ? "paused"
          : "recording";
      const data =
        operation === "capture.status"
          ? {
              state: deviceState,
              recordingId: take?.recordingId ?? null,
              sourceId: take?.sourceId ?? null,
              elapsedUs: take ? 0 : null,
              selection,
              permissions: { screen: true, microphone: "authorized", camera: "not_determined" },
            }
          : { ...take, sequence: ++sequence, state };
      if (operation !== "capture.status") deviceState = state;
      if (operation === "capture.cancel") {
        take = undefined;
        selection = null;
        deviceState = "idle";
      }
      if (operation === silentOperation) {
        unanswered.set(operation, message.request.id!);
        continue;
      }
      input.write(
        JSON.stringify({
          event: "result",
          response: {
            id: message.request.id,
            ok: true,
            data,
          },
        }) + "\n",
      );
    }
  });
  const service = await startProjectService({
    home,
    control: { input, output },
    worker: async (operation, params, options) => {
      if (operation === "storage.clearRenderWorkspace")
        return { ok: true, data: { removed: true } };
      if (operation === "media.audioCapabilities") return { ok: true, data: {} };
      if (worker) return worker(operation, params, options);
      return filesWorker(operation, params, options);
    },
  });
  cleanup.push(() => service.close());
  return {
    home,
    service,
    input,
    nativeCalls,
    reply(operation: string, data: unknown) {
      const id = unanswered.get(operation);
      if (!id) throw new Error(`No unanswered controller request: ${operation}`);
      unanswered.delete(operation);
      input.write(JSON.stringify({ event: "result", response: { id, ok: true, data } }) + "\n");
    },
    call: (operation: string, params: Record<string, unknown> = {}) =>
      callLocal(service.socketPath, { id: randomUUID(), operation, params }),
    report: (params: Record<string, unknown>) =>
      new Promise<OperationResult>((resolve) => {
        if (
          ["complete", "interrupted"].includes(String(params.state)) &&
          params.recordingId === take?.recordingId
        ) {
          take = undefined;
          selection = null;
          deviceState = "idle";
        }
        const id = randomUUID();
        reports.set(id, resolve);
        input.write(
          JSON.stringify({
            event: "request",
            request: { id, operation: "capture.report", params },
          }) + "\n",
        );
      }),
  };
}

export const sourceWorker: MediaWorker = async (operation, params, options) => {
  if (operation.startsWith("storage.")) return filesWorker(operation, params, options);
  if (operation === "media.sourceEvidence") {
    const header = JSON.parse(
      await readFile(join(String(params.directory), "capture.journal.jsonl"), "utf8"),
    );
    await writeFile(String(params.output), "");
    return {
      ok: true,
      data: {
        file: params.output,
        journal: "capture.journal.jsonl",
        header,
        cursorSamples: 0,
        geometryRecords: 0,
        displaySpaces: 0,
        pauseEvents: 0,
        audioIntervals: 0,
        lastSequence: 0,
        incompleteTail: false,
        finished: true,
        bytes: 0,
      },
    };
  }
  if (operation === "media.probe") {
    const bytes = Buffer.from(
      JSON.stringify({
        originUs: 0,
        streams: [
          {
            id: "track:1",
            kind: "video",
            codec: "fixture",
            width: 16,
            height: 16,
            orientedWidth: 16,
            orientedHeight: 16,
            decodable: true,
            startUs: 0,
            endUs: 100,
            segments: [{ startUs: 0, endUs: 100, empty: false }],
          },
        ],
      }),
    );
    writeSync(
      options!.descriptors![Number(String(params.output).split("/").at(-1)) - 3]!,
      bytes,
      0,
      bytes.length,
      0,
    );
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  }
  throw new Error(`Unexpected fixture worker operation: ${operation}`);
};

// This filesystem edge exercises coordination, not native descriptor validation.
export const filesWorker: MediaWorker = async (operation, params, options) => {
  if (operation === "storage.recordingDirectory") {
    const info = fstatSync(options!.descriptors![0]!, { bigint: true });
    return { ok: true, data: { dev: String(info.dev), ino: String(info.ino) } };
  }
  if (operation === "storage.removeRecordingDirectory") {
    await rm(join(String(params.home), "recordings", String(params.recordingId)), {
      recursive: true,
      force: true,
    });
    return { ok: true, data: { removed: true } };
  }
  throw new Error(`Unexpected worker operation: ${operation}`);
};
