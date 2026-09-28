import { constants } from "node:fs";
import { copyFile, mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import type { CompositionMovie, ProjectMovieRenderer } from "@screenrec/core/project-preview";
import type { ProjectFrameRenderer } from "@screenrec/core/frame-inspection";
import type { ProjectAudioRenderer } from "@screenrec/core/audio-inspection";
import { withRenderAttempt, withRenderedFile } from "./render.js";
import { renderWindowDeadlineMs, nativeResult, type MediaWorker } from "./worker.js";

/** Compiled pictures and PCM share the existing attempt and final movie publication boundary. */
export function projectMovieRenderer(worker: MediaWorker, workspace: string): ProjectMovieRenderer {
  return {
    implementationId: "native-composition-movie-v3",
    async render(request, signal) {
      await mkdir(workspace, { recursive: true, mode: 0o700 });
      const { manifest } = request.window;
      return withRenderAttempt(
        worker,
        workspace,
        signal,
        async (directory, execute) => {
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
          const response = await execute(
            "media.renderCompositionMovie",
            {
              output: file,
              frames,
              range: manifest.range,
              canvas: manifest.canvas,
              profile: "h264-rec709",
              processing: manifest.processing,
              assets: request.assets,
              audio: { range: manifest.sampleRange, clips: [...request.window.audio()] },
            },
            {
              signal,
              // Video rendering and PCM/AAC assembly each get the retained playback duration.
              // Sparse source seeks do not budget discarded recording prefixes.
              timeoutMs: renderWindowDeadlineMs(manifest.range),
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

export function projectAudioRenderer(worker: MediaWorker, workspace: string): ProjectAudioRenderer {
  return {
    implementationId: "native-composition-audio-v2",
    render: async ({ window, assets, output }, signal) =>
      withRenderedFile(
        worker,
        { attemptParent: workspace, output, filename: "audio.wav" },
        signal,
        async (file, execute) =>
          nativeResult(
            await execute(
              "media.mixCompositionAudio",
              {
                output: file,
                range: window.manifest.sampleRange,
                clips: [...window.audio()],
                processing: window.manifest.processing,
                assets,
              },
              { signal, timeoutMs: renderWindowDeadlineMs(window.manifest.range) },
            ),
          ),
      ),
  };
}

export function projectFrameRenderer(worker: MediaWorker, workspace: string): ProjectFrameRenderer {
  return {
    implementationId: "native-composition-picture-v2",
    render: async ({ window, assets, output, maxLongEdge }, signal) =>
      withRenderedFile(
        worker,
        { attemptParent: workspace, output, filename: "frame.png" },
        signal,
        async (file, execute) =>
          nativeResult(
            await execute(
              "media.renderCompositionFrame",
              {
                output: file,
                frame: window.frames().next().value,
                canvas: window.manifest.canvas,
                profile: "h264-rec709",
                processing: window.manifest.processing,
                assets,
                maxLongEdge,
              },
              { signal },
            ),
          ),
      ),
  };
}
