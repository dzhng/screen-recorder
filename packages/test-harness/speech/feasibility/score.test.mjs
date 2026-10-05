import assert from "node:assert/strict";
import test from "node:test";
import { diarizationScore, eventScores } from "./score.mjs";

test("overlapping speaker time contributes missed/confused speech and anonymous labels match globally", () => {
  const reference = [
    { speaker: "A", start: 0, end: 2 },
    { speaker: "B", start: 1, end: 3 },
  ];
  const result = diarizationScore(reference, [{ speaker: "speaker7", start: 0, end: 3 }], 3);
  assert.equal(result.referenceSpeakerSeconds, 4);
  assert.equal(result.overlapSeconds, 1);
  assert.equal(result.missedSpeakerSeconds, 1);
  assert.equal(result.confusedSpeakerSeconds, 1);
  assert.equal(result.falseSpeakerSeconds, 0);
  assert.equal(result.der, 0.5);
  assert.equal(
    diarizationScore(
      reference,
      [
        { speaker: "x", start: 0, end: 2 },
        { speaker: "y", start: 1, end: 3 },
      ],
      3,
    ).der,
    0,
  );
});

test("event categories retain independent positives, errors and abstained denominators", () => {
  const scores = eventScores(
    [
      { id: "laugh", labels: ["Laughter"], scores: { Laughter: 0.8, Applause: 0.6 } },
      { id: "clap", labels: ["Applause"], scores: { Laughter: 0.2, Applause: 0.7 } },
    ],
    ["Laughter", "Applause"],
    0.5,
  );
  assert.deepEqual(scores.Laughter, {
    truePositives: ["laugh"],
    falsePositives: [],
    falseNegatives: [],
    trueNegatives: ["clap"],
    precision: 1,
    recall: 1,
  });
  assert.deepEqual(scores.Applause, {
    truePositives: ["clap"],
    falsePositives: ["laugh"],
    falseNegatives: [],
    trueNegatives: [],
    precision: 0.5,
    recall: 1,
  });
  const empty = eventScores(
    [{ id: "none", labels: [], scores: { Laughter: 0.1 } }],
    ["Laughter"],
    0.5,
  );
  assert.equal(empty.Laughter.precision, null);
  assert.equal(empty.Laughter.recall, null);
});
