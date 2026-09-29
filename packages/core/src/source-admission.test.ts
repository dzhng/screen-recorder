import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { fileIdentity } from "./files.js";
import { verifySourceEvidence } from "./source-admission.js";
import type { SourceEvidenceReceipt } from "./evidence.js";

test("canonical admission preserves historical receipt format but verifies current diagnostic text", async () => {
  const directory = await mkdtemp("/tmp/source-diagnostic-");
  try {
    const journal = join(directory, "capture.journal.jsonl");
    const body = "immutable journal fixture";
    await writeFile(journal, body);
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    const current: SourceEvidenceReceipt = {
      normalizationVersion: 2,
      file: "unused",
      journal: "capture.journal.jsonl",
      header: { sessionID: "source" },
      cursorSamples: 0,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: 0,
      lastSequence: 2,
      incompleteTail: false,
      finished: true,
      bytes: 0,
      completion: {
        sequence: 2,
        state: "interrupted",
        durationUs: 0,
        failureCode: "DEVICE_LOST",
        failureMessage: "The microphone disconnected.",
      },
    };
    const { file: _file, ...receipt } = current;
    const verify = (expected: typeof receipt) =>
      verifySourceEvidence({
        directory,
        receipt: expected,
        signal: new AbortController().signal,
        canonical: {},
        files: {
          journal: {
            path: journal,
            bytes: Buffer.byteLength(body),
            sha256: digest(body),
            identity: fileIdentity(stat),
          },
          normalized: { bytes: 0, sha256: digest("") },
        },
        exportSource: async (_source, output) => {
          await writeFile(output, "");
          return { ...current, file: output };
        },
        audio: () => {
          throw new Error("No audio in fixture");
        },
      });
    const stat = await lstat(journal, { bigint: true });
    await verify(receipt);
    const { normalizationVersion: _version, ...historical } = receipt;
    const { failureMessage: _message, ...completion } = current.completion!;
    await verify({ ...historical, completion });
    await expect(
      verify({ ...receipt, completion: { ...current.completion!, failureMessage: "Altered" } }),
    ).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
    await expect(
      verify({ ...historical, completion: { ...completion, failureCode: "ALTERED" } }),
    ).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
