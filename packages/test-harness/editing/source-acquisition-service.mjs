import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startProjectService } from "../../../apps/service/dist/project-service.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";

// Barriers hold real native replies; they never manufacture media, metadata or receipts.
const native = mediaWorker();
let armed;
let speechOrdinal = 0;
let audioOrdinal = 0;
process.on("message", (message) => {
  if (message?.type === "barrier.arm") {
    if (armed) throw new Error("A native barrier is already armed");
    armed = message;
    process.send({ type: "barrier.armed", id: message.id });
  }
});
const worker = async (operation, params, options) => {
  const result = await native(operation, params, options);
  if (process.argv[3] && operation === "media.sourceAudio") {
    const directory = process.argv[3];
    await mkdir(directory, { recursive: true });
    const prefix = join(directory, `audio-${audioOrdinal++}`);
    await writeFile(`${prefix}-request.json`, JSON.stringify(params, null, 2));
    await writeFile(`${prefix}-response.json`, JSON.stringify(result, null, 2));
  }
  if (process.argv[3] && operation === "speech.transcribe" && result.ok) {
    const directory = process.argv[3];
    await mkdir(directory, { recursive: true });
    const prefix = join(directory, `speech-${speechOrdinal++}`);
    await writeFile(`${prefix}-request.json`, JSON.stringify(params, null, 2));
    await writeFile(`${prefix}-response.json`, JSON.stringify(result, null, 2));
    await copyFile(params.output, `${prefix}.jsonl`);
  }
  if (armed?.operation === operation && --armed.remaining === 0) {
    const fault = armed;
    armed = undefined;
    if (!result.ok) throw new Error(JSON.stringify(result));
    await new Promise((resolve) => {
      const done = () => {
        options.signal.removeEventListener("abort", done);
        resolve();
      };
      options.signal.addEventListener("abort", done, { once: true });
      process.send({ type: "barrier.hit", id: fault.id, operation, nativeSucceeded: true });
      if (options.signal.aborted) done();
    });
  }
  return result;
};
try {
  const service = await startProjectService({ home: process.argv[2], worker });
  let closing;
  const close = () => (closing ??= service.close().then(() => process.disconnect()));
  process.on("message", (message) => {
    if (message === "close") void close();
  });
  process.on("disconnect", () => {
    void close();
  });
  process.send({ socketPath: service.socketPath });
} catch (error) {
  process.send({ error: { code: error.code, message: error.message } });
  process.disconnect();
  process.exitCode = 1;
}
