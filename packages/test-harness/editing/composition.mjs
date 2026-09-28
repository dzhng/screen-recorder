import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateComposition,
  projectToSource,
  sourceToProject,
} from "../../composition/dist/index.js";

if (process.argv.slice(2).join(" ") !== "--fixture repeat-reorder") {
  console.error(
    "Usage: node packages/test-harness/editing/composition.mjs --fixture repeat-reorder",
  );
  process.exitCode = 1;
} else {
  const oracle = JSON.parse(await readFile(new URL("./expected.json", import.meta.url), "utf8"));
  const assets = Object.keys(oracle.clips).map((id) => ({
    id,
    streams: ["video", "audio"].map((kind) => ({
      id: kind,
      kind,
      bounds: { startUs: 0, endUs: 2000000 },
      available: [{ startUs: 0, endUs: 2000000 }],
    })),
  }));
  const model = validateComposition(
    {
      canvas: {
        width: 160,
        height: 96,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
      tracks: [
        { id: "picture", kind: "video", order: 0 },
        { id: "sound", kind: "audio", order: 0 },
      ],
      clips: [
        ...oracle.compositionScenario.placements.map((item) => ({
          id: item.id,
          assetId: item.clip,
          streamId: "video",
          trackId: "picture",
          source: { kind: "range", range: { startUs: item.source[0], endUs: item.source[1] } },
          placement: {
            kind: "project",
            range: { startUs: item.project[0], endUs: item.project[1] },
          },
        })),
        {
          id: "independent-audio",
          assetId: "b",
          streamId: "audio",
          trackId: "sound",
          source: { kind: "range", range: { startUs: 0, endUs: 1600000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1600000 } },
        },
        {
          id: "a-again",
          assetId: "a",
          streamId: "video",
          trackId: "picture",
          source: { kind: "range", range: { startUs: 0, endUs: 500000 } },
          placement: { kind: "project", range: { startUs: 1600000, endUs: 2100000 } },
        },
      ],
      syncGroups: [],
      processing: [],
      groups: [],
      captions: [],
    },
    assets,
  );
  const memberships = oracle.compositionScenario.membership.map((expected) => {
    const occurrences = projectToSource(model, expected.atUs);
    const video = occurrences.find((item) => item.streamId === "video");
    const audio = occurrences.find((item) => item.streamId === "audio");
    assert.equal(video.clipId, expected.instance);
    const fps = Number(oracle.clips[video.assetId].fps.split("/")[0]);
    assert.equal(Math.floor((video.sourceUs * fps) / 1000000), expected.frame);
    assert.equal(audio.assetId, expected.audio);
    assert.equal(audio.sourceUs, expected.atUs);
    return { atUs: expected.atUs, occurrences };
  });
  const reverse = sourceToProject(model, { assetId: "a", streamId: "video", atUs: 250000 });
  assert.deepEqual(
    reverse.map((item) => [item.clipId, item.firstProjectUs]),
    [
      ["a-first", 250000],
      ["a-again", 1850000],
    ],
  );
  console.log(
    JSON.stringify(
      {
        status: "passed",
        fixture: "repeat-reorder",
        durationUs: model.durationUs,
        memberships,
        reverse,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}
