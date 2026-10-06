import { expect, test } from "vitest";
import { projectAlignmentRows } from "./project-alignment.js";

test("project alignment preserves source rows and maps each supported fragment to project time", () => {
  const t = (value: number) => ({ numerator: BigInt(value), denominator: 1n });
  const rows = [
    {
      kind: "supplied" as const,
      ordinal: 0,
      text: "hello",
      correspondence: "matched" as const,
      possibleIndices: [0],
      omissionPossible: false,
      lexicalIdentity: "unknown" as const,
      timing: {
        startFrame: 0,
        endFrame: 2,
        sourceRange: { startUs: 1_000_000, endUs: 3_000_000 },
        physicalAdmission: "within_source_support" as const,
        interpretation: "conditional_supplied_path" as const,
      },
      nativeTokens: [1],
      nativeTokenizationUnknown: false,
      assignmentConfidence: null,
    },
    {
      kind: "observed" as const,
      ordinal: 1,
      text: "world",
      correspondence: "observed_extra" as const,
      possibleIndices: [],
      omissionPossible: false,
      lexicalIdentity: "unknown" as const,
      timing: null,
      nativeTokens: [2],
      nativeTokenizationUnknown: false,
      assignmentConfidence: null,
    },
  ];
  const result = projectAlignmentRows(rows, [
    {
      clipId: "clip-a",
      assetId: "asset-a",
      streamId: "stream-a",
      trackId: "track-a",
      trackRank: 0,
      project: { start: t(0), end: t(5_000_000) },
      fragments: [
        {
          source: { start: t(0), end: t(2_000_000) },
          project: { start: t(10_000_000), end: t(12_000_000) },
        },
        {
          source: { start: t(2_000_000), end: t(5_000_000) },
          project: { start: t(20_000_000), end: t(23_000_000) },
        },
      ],
      unavailable: [],
    },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]!.row).toBe(rows[0]);
  expect(result[0]!.occurrence.clipId).toBe("clip-a");
  expect(result[0]!.projectRanges).toEqual([
    { startUs: 11_000_000, endUs: 12_000_000 },
    { startUs: 20_000_000, endUs: 21_000_000 },
  ]);
  expect(result[0]!.sourceRanges).toEqual([
    { startUs: 1_000_000, endUs: 2_000_000 },
    { startUs: 2_000_000, endUs: 3_000_000 },
  ]);
});

test("project alignment emits no project row for null timing and never invents timing", () => {
  const row = {
    kind: "observed" as const,
    ordinal: 0,
    text: "unknown",
    correspondence: "unknown" as const,
    possibleIndices: [],
    omissionPossible: true,
    lexicalIdentity: "unknown" as const,
    timing: null,
    nativeTokens: [],
    nativeTokenizationUnknown: null,
    assignmentConfidence: null,
  };
  expect(projectAlignmentRows([row], [])).toEqual([]);
});

test("project alignment retains fractional exact bounds instead of rounding them away", () => {
  const t = (numerator: number, denominator = 1) => ({
    numerator: BigInt(numerator),
    denominator: BigInt(denominator),
  });
  const f = (numerator: number, denominator: number) => ({ numerator, denominator });
  const row = {
    kind: "observed" as const,
    ordinal: 0,
    text: "fractional",
    correspondence: "matched" as const,
    possibleIndices: [0],
    omissionPossible: false,
    lexicalIdentity: "unknown" as const,
    timing: {
      startFrame: 0,
      endFrame: 1,
      sourceRange: { startUs: 0, endUs: 1 },
      physicalAdmission: "within_source_support" as const,
      interpretation: "greedy_observation" as const,
    },
    nativeTokens: [1],
    nativeTokenizationUnknown: false,
    assignmentConfidence: null,
  };
  const result = projectAlignmentRows(
    [row],
    [
      {
        clipId: "clip-fractional",
        assetId: "asset-fractional",
        streamId: "stream-fractional",
        trackId: "track-fractional",
        trackRank: 0,
        project: { start: t(0), end: t(1) },
        fragments: [
          {
            source: { start: t(0), end: t(1) },
            project: { start: t(1, 10), end: t(1, 5) },
          },
        ],
        unavailable: [],
      },
    ],
  );
  expect(result[0]!.projectRanges).toEqual([{ startUs: f(1, 10), endUs: f(1, 5) }]);
});
