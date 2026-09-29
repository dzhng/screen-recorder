import { createCompiler, validateComposition } from "@screenrec/composition";
import { encodeJsonLine, REQUEST_FRAME_BYTES } from "@screenrec/protocol";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";
import { projectAudioRenderer } from "./project-render.js";
import type { MediaWorker } from "./worker.js";

test("a large compiled audio plan reaches execution without enlarging control frames", async () => {
  const directory = await mkdtemp(join(tmpdir(), "compiled-render-"));
  try {
    const asset = {
      id: "a".repeat(64),
      streams: [
        {
          id: "0",
          kind: "audio" as const,
          channels: 2,
          sampleRate: 48000,
          bounds: { startUs: 0, endUs: 1000000 },
          available: [{ startUs: 0, endUs: 1000000 }],
        },
      ],
    };
    const model = validateComposition(
      {
        canvas: {
          width: 16,
          height: 16,
          fps: { numerator: 30, denominator: 1 },
          background: "#000000ff",
        },
        tracks: [{ id: "audio", kind: "audio", order: 0 }],
        groups: [],
        syncGroups: [],
        clips: Array.from({ length: 1000 }, (_, i) => ({
          id: `clip:${"b".repeat(64)}:${i}`,
          trackId: "audio",
          assetId: asset.id,
          streamId: "0",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: i * 1000000, endUs: (i + 1) * 1000000 } },
        })),
        processing: [
          {
            target: { kind: "output" },
            steps: [{ id: "noise", enabled: true, processor: { type: "rnnoise" } }],
          },
        ],
      },
      [asset],
    );
    const window = createCompiler(model, "revision").audioWindow({
      range: { startUs: 0, endUs: 1000000000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const worker: MediaWorker = async (operation, params) => {
      encodeJsonLine({ id: `worker-${operation}`, operation, params }, REQUEST_FRAME_BYTES);
      if (operation === "storage.clearRenderWorkspace")
        return { ok: true, data: { removed: true } };
      const plan =
        typeof params.planFile === "string"
          ? JSON.parse(await readFile(params.planFile, "utf8"))
          : params;
      await writeFile(
        plan.output,
        JSON.stringify({ clips: plan.clips, range: plan.range, state: plan.state }),
      );
      return { ok: true, data: { file: plan.output } };
    };
    const output = join(directory, "delivered.json");
    await projectAudioRenderer(worker, join(directory, "render"), "rnnoise-fixture").render(
      {
        window,
        assets: [
          { assetId: asset.id, streamId: "0", path: join(directory, "source.wav"), originUs: 0 },
        ],
        output,
      },
      new AbortController().signal,
    );
    const delivered = JSON.parse(await readFile(output, "utf8"));
    expect(delivered.clips).toEqual([...window.audio()]);
    expect(delivered.range).toEqual(window.manifest.sampleRange);
    expect(delivered.state).toEqual({
      ...window.audioState(),
      implementationId: "rnnoise-fixture",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
