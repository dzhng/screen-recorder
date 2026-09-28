import { constants } from "node:fs";
import { copyFile, mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import type { CompositionMovie, ProjectMovieRenderer } from "@screenrec/core/project-preview";
import { withRenderAttempt } from "./render.js";
import { MAX_MEDIA_TIMEOUT_MS, nativeResult, type MediaWorker } from "./worker.js";

/** Compiled pictures and PCM share the existing attempt and final movie publication boundary. */
export function projectMovieRenderer(worker: MediaWorker, workspace: string): ProjectMovieRenderer {
  return {
    implementationId: "native-composition-movie-v1",
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
          const durationUs = manifest.range.endUs - manifest.range.startUs;
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
              timeoutMs: Math.min(MAX_MEDIA_TIMEOUT_MS, 30_000 + 2 * Math.ceil(durationUs / 1000)),
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
