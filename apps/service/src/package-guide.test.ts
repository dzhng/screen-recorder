import { test, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PackageSnapshot } from "@screenrec/core/package-manifest";
import type { TranscriptWordRecord } from "@screenrec/core/transcript";
import { writePackageGuide } from "./package-guide.js";

const snapshot: PackageSnapshot = {
  recordingId: "take",
  sourceId: "source",
  revisionId: "edited",
  sourceDurationUs: 1000,
  historyThroughOrdinal: 1,
  capture: { state: "complete", createdAt: "fixture", interruptionReason: null },
};

test("plain transcript preserves source words across pages and separates speech segments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "package-guide-"));
  const texts = [
    "Um,",
    ...Array.from({ length: 255 }, (_, i) => `word${i}`),
    "café.",
    "Next",
    "segment.",
  ];
  const words: TranscriptWordRecord[] = texts.map((text, ordinal) => ({
    ordinal,
    text,
    startUs: ordinal,
    endUs: ordinal + 1,
    kind: ordinal === 0 ? "filler" : "speech",
    confidence: null,
    instant: false,
    segment: ordinal < 257 ? 0 : 1,
  }));
  try {
    await writePackageGuide(
      directory,
      snapshot,
      { ...snapshot, generation: "transcript", wordCount: words.length },
      {
        wordRecords: (_identity, query) =>
          words
            .filter((word) => !query.lower || word.ordinal > query.lower.key[1]!)
            .slice(0, query.limit),
      },
      new AbortController().signal,
    );
    expect(await readFile(join(directory, "transcript.txt"), "utf8")).toBe(
      texts.slice(0, 257).join(" ") + "\n\nNext segment.\n",
    );
    const guide = await readFile(join(directory, "README.md"), "utf8");
    expect(guide).toContain("[transcript.txt](transcript.txt)");
    expect(guide).toContain("`edited`");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test.for([null, { ...snapshot, generation: "silent", wordCount: 0 }])(
  "missing speech is explicit in the root transcript",
  async (transcript) => {
    const directory = await mkdtemp(join(tmpdir(), "package-guide-empty-"));
    try {
      await writePackageGuide(
        directory,
        snapshot,
        transcript,
        { wordRecords: () => [] },
        new AbortController().signal,
      );
      expect(await readFile(join(directory, "transcript.txt"), "utf8")).toBe(
        transcript
          ? "No speech was recognized in the acquired narration.\n"
          : "No microphone narration was acquired for this recording.\n",
      );
      const guide = await readFile(join(directory, "README.md"), "utf8");
      expect(guide.includes("(evidence/source-transcript/pages.json)")).toBe(transcript !== null);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
