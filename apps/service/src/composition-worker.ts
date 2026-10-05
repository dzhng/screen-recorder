import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { encodeJsonLine, REQUEST_FRAME_BYTES } from "@screenrec/protocol";
import type { MediaWorker } from "./worker.js";

/** Large compiled plans share the attempt lifetime; control framing stays bounded. */
export async function executeComposition(
  worker: MediaWorker,
  operation:
    | "media.mixCompositionAudio"
    | "media.renderCompositionMovie"
    | "media.validateCompositionAudio"
    | "media.prepareCompositionAudioDomain",
  params: Record<string, unknown> & { output: string },
  options: NonNullable<Parameters<MediaWorker>[2]>,
) {
  options.signal?.throwIfAborted();
  // Validate strict JSON before choosing a transport, including omitted optional fields.
  const frame = encodeJsonLine({ id: `worker-${operation}`, operation, params }, 64 * 1024 ** 2);
  if (frame.length <= REQUEST_FRAME_BYTES) return worker(operation, params, options);
  const planFile = join(dirname(params.output), `composition-plan-${randomUUID()}.json`);
  const handle = await open(planFile, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(params), { signal: options.signal });
  } finally {
    await handle.close();
  }
  options.signal?.throwIfAborted();
  try {
    return await worker(operation, { planFile }, options);
  } finally {
    await unlink(planFile);
  }
}
