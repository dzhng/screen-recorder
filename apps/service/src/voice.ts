import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import { copyImportedFile, hashFile } from "@screenrec/core/files";
import { withRenderedFile } from "./render.js";
import { jsonWorker, nativeResult, type MediaWorker } from "./worker.js";
import { voiceEntryPins } from "./voice-pins.js";

/** Supplied by explicit preparation, never discovered from a user home or temporary directory. */
export type PreparedVoice = Readonly<{
  python: string;
  entry: string;
  model: string;
  cache: string;
}>;
export type VoiceRequest = Readonly<{
  reference: string;
  referenceText: string;
  text: string;
  generation: Readonly<Record<string, string | number | boolean>>;
  seed: number;
  output: string;
}>;

/** Private entry checkpoint; durable jobs and asset admission remain separate owners. */
export function voiceRenderer(native: MediaWorker, preparation: PreparedVoice, workspace: string) {
  return async (request: VoiceRequest, signal: AbortSignal, timeoutMs = 600_000) => {
    if (
      ![...Object.values(preparation), workspace, request.reference, request.output].every(
        isAbsolute,
      )
    )
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
    const pinsPath = join(dirname(preparation.entry), "pins.json");
    let preparedIdentity: { runtimeCommit: string; modelRevision: string } | undefined;
    // These are shipped pins, not identities asserted by the supplied executable itself.
    for (const [path, expected] of [
      [preparation.python, voiceEntryPins.python],
      [preparation.entry, voiceEntryPins.entry],
      [pinsPath, voiceEntryPins.pins],
    ] as const) {
      let file;
      try {
        file = await open(path, "r");
      } catch {
        throw new CatalogError("MODEL_NOT_PREPARED", "Voice runtime preparation is missing");
      }
      try {
        const info = await file.stat();
        if (
          !info.isFile() ||
          info.size !== expected.bytes ||
          (await hashFile(file, info.size, signal)).sha256 !== expected.sha256
        )
          throw new CatalogError(
            "MODEL_NOT_PREPARED",
            "Voice runtime preparation identity differs",
          );
        if (path === pinsPath) preparedIdentity = JSON.parse(await file.readFile("utf8"));
      } finally {
        await file.close();
      }
    }
    if (!preparedIdentity)
      throw new CatalogError("MODEL_NOT_PREPARED", "Voice preparation manifest is missing");
    const identity = preparedIdentity;
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
          receipt.runtimeRevision !== identity.runtimeCommit ||
          receipt.modelRevision !== identity.modelRevision ||
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
