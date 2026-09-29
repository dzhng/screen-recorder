import { encodeJsonLine, REQUEST_FRAME_BYTES } from "@screenrec/protocol";
import { nativeProcessing } from "./native-processing.js";
import { constants } from "node:fs";
import { copyFile, mkdir, open } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import type { CompositionMovie, ProjectMovieRenderer } from "@screenrec/core/project-preview";
import type { ProjectFrameRenderer } from "@screenrec/core/frame-inspection";
import type { ProjectAudioRenderer } from "@screenrec/core/audio-inspection";
import { withRenderAttempt, withRenderedFile } from "./render.js";
import { renderWindowDeadlineMs, nativeResult, type MediaWorker } from "./worker.js";

import type {
  PointerPreparation,
  PointerHistoryRenderer,
} from "@screenrec/core/pointer-preparation";
import type { SourceEvidenceReader } from "@screenrec/core/evidence-read";
import type { PresentationReceipt } from "@screenrec/core/presentation-evidence";
import { prepareCompositionPointers } from "@screenrec/core/composition-pointer";
import { renderPlan } from "@screenrec/core/timeline";
/** A bounded metadata-only probe. An absent/older worker leaves authoring and retained reads usable. */
export async function nativeRNNoise(worker: MediaWorker): Promise<string | undefined> {
  try {
    const result = nativeResult(await worker("media.audioCapabilities", {}, { timeoutMs: 5000 }));
    if (typeof result !== "object" || result === null || !("rnnoise" in result)) return;
    const identity = result.rnnoise;
    return typeof identity === "string" && /^rnnoise-[a-zA-Z0-9-]{1,240}$/.test(identity)
      ? identity
      : undefined;
  } catch {
    return undefined;
  }
}
/** Large compiled plans share the attempt lifetime; control framing stays bounded. */
async function executeComposition(
  worker: MediaWorker,
  operation: "media.mixCompositionAudio" | "media.renderCompositionMovie",
  params: Record<string, unknown> & { output: string },
  options: NonNullable<Parameters<MediaWorker>[2]>,
) {
  options.signal?.throwIfAborted();
  // Validate strict JSON before choosing a transport, including omitted optional fields.
  const frame = encodeJsonLine({ id: `worker-${operation}`, operation, params }, 64 * 1024 ** 2);
  if (frame.length <= REQUEST_FRAME_BYTES) return worker(operation, params, options);
  const planFile = join(dirname(params.output), "composition-plan.json");
  const handle = await open(planFile, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(params), { signal: options.signal });
  } finally {
    await handle.close();
  }
  options.signal?.throwIfAborted();
  return worker(operation, { planFile }, options);
}

function statePayload(
  window: Parameters<ProjectAudioRenderer["render"]>[0]["window"],
  identity?: string,
) {
  const state = window.audioState();
  if (!state) return {};
  if (!identity) throw new CatalogError("NOT_READY", "The native RNNoise recipe is unavailable");
  return {
    state: { ...state, processing: nativeProcessing(state.processing), implementationId: identity },
  };
}
function audioDeadline(window: Parameters<ProjectAudioRenderer["render"]>[0]["window"]) {
  const workUs = (window.manifest.state?.domains ?? []).reduce(
    (total, domain) =>
      total + ((domain.sampleRange.end - domain.sampleRange.start) * 1000000) / 48000,
    0,
  );
  return renderWindowDeadlineMs({
    startUs: 0,
    endUs: window.manifest.range.endUs - window.manifest.range.startUs + workUs,
  });
}
type PointerOwners = { preparation: PointerPreparation; evidence: SourceEvidenceReader };
export function projectPointerHistoryRenderer(
  worker: MediaWorker,
  workspace: string,
): PointerHistoryRenderer {
  return {
    implementationId: "native-pointer-presentation-v1",
    render: async (request, signal) =>
      (await withRenderedFile(
        worker,
        { attemptParent: workspace, output: request.output, filename: "presentation.jsonl" },
        signal,
        async (output, execute) =>
          nativeResult(
            await execute(
              "media.presentationEvidence",
              {
                source: request.source,
                streamId: request.streamId,
                clockOffsetUs: request.clockOffsetUs,
                plan: renderPlan({ spans: request.spans }),
                output,
                ...request.limits,
              },
              {
                signal,
                timeoutMs: renderWindowDeadlineMs({
                  startUs: 0,
                  endUs: request.spans.reduce((sum, span) => sum + span.endUs - span.startUs, 0),
                }),
              },
            ),
          ) as PresentationReceipt,
      )) as PresentationReceipt,
  };
}
async function pointerFile(
  owners: PointerOwners | undefined,
  request: Pick<Parameters<ProjectMovieRenderer["render"]>[0], "window" | "model">,
  directory: string,
  signal: AbortSignal,
) {
  if (
    !owners ||
    !request.window.manifest.processing.some((node) =>
      node.steps.some((step) => step.enabled && step.processor.type === "pointer"),
    )
  )
    return undefined;
  return prepareCompositionPointers(
    {
      model: request.model,
      frames: () => request.window.frames(),
      output: join(directory, "pointers.jsonl"),
      preparation: owners.preparation,
      evidence: owners.evidence,
    },
    signal,
  );
}

/** Compiled pictures and PCM share the existing attempt and final movie publication boundary. */
export function projectMovieRenderer(
  worker: MediaWorker,
  workspace: string,
  pointers?: PointerOwners,
  rnnoise?: string,
): ProjectMovieRenderer {
  return {
    implementationId: "native-composition-movie-v18",
    ...(rnnoise ? { rnnoise } : {}),
    ...(pointers ? { pointers: pointers.preparation } : {}),
    async render(request, signal) {
      await mkdir(workspace, { recursive: true, mode: 0o700 });
      const { manifest } = request.window;
      return withRenderAttempt(
        worker,
        workspace,
        signal,
        async (directory, execute) => {
          const prepared = await pointerFile(pointers, request, directory, signal);
          const frames = join(directory, "frames.jsonl");
          const handle = await open(frames, "wx", 0o600);
          let frameCount = 0;
          try {
            let batch = "";
            for (const frame of request.window.frames()) {
              signal.throwIfAborted();
              batch += JSON.stringify(frame) + "\n";
              frameCount++;
              if (Buffer.byteLength(batch) >= 64 * 1024) {
                await handle.writeFile(batch);
                batch = "";
              }
            }
            if (batch) await handle.writeFile(batch);
          } finally {
            await handle.close();
          }
          signal.throwIfAborted();
          const file = join(directory, "movie.mp4");
          const response = await executeComposition(
            execute,
            "media.renderCompositionMovie",
            {
              output: file,
              ...(prepared ? { pointers: prepared } : {}),
              frames,
              range: manifest.range,
              canvas: manifest.canvas,
              settings: request.settings,
              processing: nativeProcessing(request.window.processing()),
              assets: request.assets,
              fonts: request.fonts,
              audio: {
                range: manifest.sampleRange,
                clips: [...request.window.audio()],
                ...statePayload(request.window, rnnoise),
              },
            },
            {
              signal,
              // Video rendering and PCM/AAC assembly each get the retained playback duration.
              // Sparse source seeks do not budget discarded recording prefixes.
              timeoutMs: audioDeadline(request.window),
            },
          );
          signal.throwIfAborted();
          const movie = nativeResult(response) as CompositionMovie;
          if (movie.file !== file || movie.frameCount !== frameCount)
            throw new CatalogError(
              "INVALID_RESPONSE",
              "Movie receipt changed the compiled frame stream",
            );
          return movie;
        },
        async (movie) => {
          await copyFile(movie.file, request.output, constants.COPYFILE_EXCL);
          return { ...movie, file: request.output };
        },
      );
    },
  };
}

export function projectAudioRenderer(
  worker: MediaWorker,
  workspace: string,
  rnnoise?: string,
): ProjectAudioRenderer {
  return {
    implementationId: "native-composition-audio-v8",
    ...(rnnoise ? { rnnoise } : {}),
    render: async ({ window, assets, output }, signal) =>
      withRenderedFile(
        worker,
        { attemptParent: workspace, output, filename: "audio.wav" },
        signal,
        async (file, execute) =>
          nativeResult(
            await executeComposition(
              execute,
              "media.mixCompositionAudio",
              {
                output: file,
                range: window.manifest.sampleRange,
                ...statePayload(window, rnnoise),
                clips: [...window.audio()],
                processing: nativeProcessing(window.processing()),
                assets,
              },
              { signal, timeoutMs: audioDeadline(window) },
            ),
          ),
      ),
  };
}

export function projectFrameRenderer(
  worker: MediaWorker,
  workspace: string,
  pointers?: PointerOwners,
): ProjectFrameRenderer {
  return {
    implementationId: "native-composition-picture-v14",
    ...(pointers ? { pointers: pointers.preparation } : {}),
    render: async (request, signal) => {
      const { window, assets, fonts, output, maxLongEdge } = request;
      return withRenderedFile(
        worker,
        { attemptParent: workspace, output, filename: "frame.png" },
        signal,
        async (file, execute) => {
          const prepared = await pointerFile(pointers, request, dirname(file), signal);
          return nativeResult(
            await execute(
              "media.renderCompositionFrame",
              {
                output: file,
                ...(prepared ? { pointers: prepared } : {}),
                frame: window.frames().next().value,
                canvas: window.manifest.canvas,
                profile: "h264-rec709",
                processing: nativeProcessing(window.processing()),
                assets,
                fonts,
                maxLongEdge,
              },
              { signal },
            ),
          );
        },
      );
    },
  };
}
