import { divide, fromTime, sampleAt, subtract } from "@screenrec/composition";
import type { AudioWindowInput, ProjectRenderSupport } from "@screenrec/core/project-window";
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
import {
  MAX_MEDIA_TIMEOUT_MS,
  renderWindowDeadlineMs,
  nativeResult,
  type MediaWorker,
} from "./worker.js";

import type {
  PointerPreparation,
  PointerHistoryRenderer,
} from "@screenrec/core/pointer-preparation";
import type { SourceEvidenceReader } from "@screenrec/core/evidence-read";
import type { PresentationReceipt } from "@screenrec/core/presentation-evidence";
import { prepareCompositionPointers } from "@screenrec/core/composition-pointer";
import { renderPlan } from "@screenrec/core/timeline";
export type NativeAudioCapabilities = { rnnoise?: string; retime?: string };
/** An absent/older worker leaves authoring and retained reads usable. */
export async function nativeAudioCapabilities(
  worker: MediaWorker,
): Promise<NativeAudioCapabilities> {
  try {
    const result = nativeResult(await worker("media.audioCapabilities", {}, { timeoutMs: 5000 }));
    if (typeof result !== "object" || result === null) return {};
    const rnnoise = "rnnoise" in result ? result.rnnoise : undefined;
    const retime = "retime" in result ? result.retime : undefined;
    return {
      ...(typeof rnnoise === "string" && /^rnnoise-[a-zA-Z0-9-]{1,240}$/.test(rnnoise)
        ? { rnnoise }
        : {}),
      ...(typeof retime === "string" && retime.length > 0 && retime.length <= 256
        ? { retime }
        : {}),
    };
  } catch {
    return {};
  }
}

function retimePayload(window: AudioWindowInput["window"], identity?: string) {
  const requirements = window.manifest.requirements.filter((item) => item.kind === "retime");
  if (!requirements.length) return {};
  if (!identity || requirements.some((item) => item.implementationId !== identity))
    throw new CatalogError(
      "NOT_READY",
      "The bound native retiming recipe is unavailable",
      {},
      true,
    );
  return { retimeImplementationId: identity };
}
function nativeAudioSupport(
  worker: MediaWorker,
  workspace: string,
  capabilities: NativeAudioCapabilities,
  signal: AbortSignal,
): Pick<ProjectRenderSupport, "rnnoise" | "retime" | "validateAudio"> {
  return {
    ...capabilities,
    ...(capabilities.retime
      ? {
          async validateAudio({ window, assets }: AudioWindowInput) {
            await mkdir(workspace, { recursive: true, mode: 0o700 });
            await withRenderAttempt(
              worker,
              workspace,
              signal,
              async (directory, execute) => {
                const result = nativeResult(
                  await executeComposition(
                    execute,
                    "media.validateCompositionAudio",
                    {
                      output: join(directory, "audio.wav"),
                      range: window.manifest.sampleRange,
                      clips: [...window.audio()],
                      processing: nativeProcessing(window.processing()),
                      assets,
                      ...statePayload(window, capabilities.rnnoise),
                      ...retimePayload(window, capabilities.retime),
                    },
                    { signal, timeoutMs: 5000 },
                  ),
                );
                if (
                  !result ||
                  typeof result !== "object" ||
                  !("retime" in result) ||
                  result.retime !== capabilities.retime
                )
                  throw new CatalogError(
                    "INVALID_NATIVE_RESPONSE",
                    "Native admission did not confirm the bound retiming recipe",
                  );
              },
              async () => undefined,
            );
          },
        }
      : {}),
  };
}
/** Large compiled plans share the attempt lifetime; control framing stays bounded. */
async function executeComposition(
  worker: MediaWorker,
  operation:
    | "media.mixCompositionAudio"
    | "media.renderCompositionMovie"
    | "media.validateCompositionAudio",
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

function retainedPayload(
  read: NonNullable<Parameters<ProjectAudioRenderer["render"]>[0]["prepared"]>,
  window: Parameters<ProjectAudioRenderer["render"]>[0]["window"],
) {
  const unavailable = [...window.audio()]
    .filter((clip) => clip.source.kind === "range")
    .map((clip) => ({
      clipId: clip.clipId,
      ranges: (read.value.unavailable.find((entry) => entry.clipId === clip.clipId)?.ranges ?? [])
        .map((range) => ({
          start: Math.max(range.start, clip.sampleRange.start),
          end: Math.min(range.end, clip.sampleRange.end),
        }))
        .filter((range) => range.end > range.start),
    }));
  return {
    retained: {
      descriptor: 3,
      identity: read.value.identity,
      bytes: read.value.bytes,
      dataOffset: read.dataOffset,
      frames: read.value.frames,
      range: read.sampleRange,
      unavailable,
    },
  };
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
export function audioDeadline(window: AudioWindowInput["window"], retained = false) {
  let preparationFrames = 0n;
  if (!retained) {
    for (const domain of window.manifest.state?.domains ?? [])
      preparationFrames += BigInt(domain.sampleRange.end - domain.sampleRange.start);
    const retimed = new Set(
      window.manifest.requirements.flatMap((item) => (item.kind === "retime" ? [item.clipId] : [])),
    );
    const seen = new Set<string>();
    for (const clip of [...window.audio(), ...(window.audioState()?.clips ?? [])]) {
      if (clip.source.kind !== "range" || !retimed.has(clip.clipId)) continue;
      const rate = divide(
        subtract(fromTime(clip.source.range.endUs), fromTime(clip.source.range.startUs)),
        subtract(fromTime(clip.placement.endUs), fromTime(clip.placement.startUs)),
      );
      for (const context of clip.context) {
        const key = JSON.stringify([
          clip.source.assetId,
          clip.source.streamId,
          `${rate.numerator}/${rate.denominator}`,
          clip.pitch,
          context,
        ]);
        if (seen.has(key)) continue;
        seen.add(key);
        preparationFrames +=
          BigInt(context.sampleRange.end - context.sampleRange.start) +
          BigInt(
            sampleAt(fromTime(context.source.endUs), 48000) -
              sampleAt(fromTime(context.source.startUs), 48000),
          );
      }
    }
  }
  // Preparation is measured in frames; only its scheduling budget rounds up to milliseconds.
  const preparationMs = Number((preparationFrames * 1000n + 47999n) / 48000n);
  return Math.min(
    MAX_MEDIA_TIMEOUT_MS,
    renderWindowDeadlineMs(window.manifest.range) + 2 * preparationMs,
  );
}
type PointerOwners = { preparation: PointerPreparation; evidence: SourceEvidenceReader };
export function projectPointerHistoryRenderer(
  worker: MediaWorker,
  workspace: string,
): PointerHistoryRenderer {
  return {
    implementationId: "native-pointer-presentation-v2",
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
  capabilities: NativeAudioCapabilities = {},
  admissionSignal: AbortSignal = new AbortController().signal,
): ProjectMovieRenderer {
  return {
    implementationId: "native-composition-movie-v21",
    ...nativeAudioSupport(worker, workspace, capabilities, admissionSignal),
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
                ...(request.prepared
                  ? retainedPayload(request.prepared, request.window)
                  : {
                      ...statePayload(request.window, capabilities.rnnoise),
                      ...retimePayload(request.window, capabilities.retime),
                    }),
              },
            },
            {
              signal,
              // Video rendering and PCM/AAC assembly each get the retained playback duration.
              // Sparse source seeks do not budget discarded recording prefixes.
              timeoutMs: audioDeadline(request.window, !!request.prepared),
              ...(request.prepared ? { descriptors: [request.prepared.fd] } : {}),
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
  capabilities: NativeAudioCapabilities = {},
  admissionSignal: AbortSignal = new AbortController().signal,
): ProjectAudioRenderer {
  return {
    implementationId: "native-composition-audio-v10",
    encodingImplementationId: "native-aac-file-v1",
    validateOutput: async (settings) => {
      nativeResult(
        await worker(
          "media.validateAudioOutput",
          { settings },
          { signal: admissionSignal, timeoutMs: 5000 },
        ),
      );
    },
    encode: async ({ source, input, settings, output }, signal) =>
      withRenderedFile(
        worker,
        { attemptParent: workspace, output, filename: "audio.m4a" },
        signal,
        async (file, execute) =>
          nativeResult(
            await execute(
              "media.encodeAudioFile",
              { source: "/dev/fd/3", input, settings, output: file },
              {
                signal,
                timeoutMs: renderWindowDeadlineMs({
                  startUs: 0,
                  endUs: Math.floor((input.frames * 1000000) / input.sampleRate),
                }),
                descriptors: [source.fd],
              },
            ),
          ),
      ),
    ...nativeAudioSupport(worker, workspace, capabilities, admissionSignal),
    render: async ({ window, assets, output, prepared }, signal) =>
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
                ...(prepared
                  ? retainedPayload(prepared, window)
                  : {
                      ...statePayload(window, capabilities.rnnoise),
                      ...retimePayload(window, capabilities.retime),
                    }),
                clips: [...window.audio()],
                processing: nativeProcessing(window.processing()),
                assets,
              },
              {
                signal,
                timeoutMs: audioDeadline(window, !!prepared),
                ...(prepared ? { descriptors: [prepared.fd] } : {}),
              },
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
    implementationId: "native-composition-picture-v17",
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
