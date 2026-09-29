import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import { copyImportedFile, hashFile } from "@screenrec/core/files";
import { withRenderedFile } from "./render.js";
import { jsonWorker, nativeResult, type MediaWorker } from "./worker.js";
import type { Models } from "@screenrec/core/models";

export type VoiceRequest = Readonly<{
  reference: string;
  referenceText: string;
  text: string;
  generation: Readonly<Record<string, string | number | boolean>>;
  seed: number;
  output: string;
}>;

/** Private entry checkpoint; durable jobs and asset admission remain separate owners. */
export function voiceRenderer(
  native: MediaWorker,
  models: Models,
  modelId: string,
  workspace: string,
) {
  return async (request: VoiceRequest, signal: AbortSignal, timeoutMs = 600_000) => {
    if (![workspace, request.reference, request.output].every(isAbsolute))
      throw new CatalogError(
        "INVALID_REQUEST",
        "Voice preparation and media paths must be absolute",
      );
    signal.throwIfAborted();
    const destination = await lstat(request.output).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (destination) throw new CatalogError("INVALID_REQUEST", "Voice destination already exists");
    const preparation = await models.voice(modelId);
    signal.throwIfAborted();
    const voice = jsonWorker(
      {
        executable: "/usr/bin/sandbox-exec",
        args: [
          "-p",
          "(version 1)(allow default)(deny network*)",
          preparation.python,
          "-I",
          "-B",
          preparation.entry,
        ],
        environment: {
          ...process.env,
          HF_HOME: preparation.cache,
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
          HF_HUB_DISABLE_IMPLICIT_TOKEN: "1",
          TOKENIZERS_PARALLELISM: "false",
          PYTHONDONTWRITEBYTECODE: "1",
        },
      },
      timeoutMs,
    );
    // Workspace cleanup stays native; both bindings share the exact process lifetime owner.
    const worker: MediaWorker = (operation, params, options) =>
      (operation === "voice.generatePrivate" ? voice : native)(operation, params, options);
    return withRenderedFile(
      worker,
      { attemptParent: workspace, output: request.output, filename: "audio.wav" },
      signal,
      async (output, execute) => {
        const reference = join(dirname(output), "reference.wav");
        const retained = await copyImportedFile(
          request.reference,
          reference,
          signal,
          undefined,
          1024 * 1024,
        );
        const receipt = nativeResult(
          await execute(
            "voice.generatePrivate",
            {
              model: preparation.model,
              reference,
              referenceText: request.referenceText,
              text: request.text,
              generation: request.generation,
              seed: request.seed,
              output,
            },
            { signal, timeoutMs },
          ),
        ) as Record<string, unknown>;
        if (
          !receipt ||
          receipt.file !== output ||
          receipt.referenceSha256 !== retained.sha256 ||
          receipt.runtimeRevision !== preparation.runtimeRevision ||
          receipt.modelRevision !== preparation.modelRevision ||
          receipt.sampleRate !== 24000 ||
          receipt.channels !== 1 ||
          !Number.isSafeInteger(receipt.frames) ||
          (receipt.frames as number) <= 0
        )
          throw new CatalogError(
            "INVALID_RESPONSE",
            "Voice receipt differs from the prepared request",
          );
        const file = await open(output, "r");
        try {
          const size = (await file.stat()).size;
          const actual = await hashFile(file, size, signal);
          if (actual.sha256 !== receipt.sha256)
            throw new CatalogError("INVALID_RESPONSE", "Voice output differs from its receipt");
        } finally {
          await file.close();
        }
        return receipt;
      },
    );
  };
}
