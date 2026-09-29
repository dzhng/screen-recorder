import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./catalog.js";
import { copyImportedFile, hashFile, type IdentifiedFile } from "./files.js";
import { sourceEvidenceRecords, type RecordRow, type SourceEvidenceReceipt } from "./evidence.js";
import type { SourceExporter } from "./processing.js";

export const sourcePublicationMembers = [
  "narration.publication.json",
  "system.publication.json",
] as const;
export type SourceAdmissionFiles = {
  journal: IdentifiedFile & { sha256: string };
  normalized: { bytes: number; sha256: string };
} & Partial<Record<(typeof sourcePublicationMembers)[number], IdentifiedFile & { sha256: string }>>;

/** Native proof precedes both transient package availability and durable source adoption.
 * The caller's existing workspace owns crash recovery; no canonical media is copied here.
 * Audio callbacks are provisional until this function returns successfully. */
export async function verifySourceEvidence(input: {
  directory: string;
  receipt: Omit<SourceEvidenceReceipt, "file">;
  files: SourceAdmissionFiles;
  canonical: NonNullable<Parameters<SourceExporter>[3]>;
  exportSource: SourceExporter;
  signal: AbortSignal;
  lifetime?: { readonly fd: number };
  audio(row: RecordRow): void;
}): Promise<void> {
  const { receipt: expected, files, canonical, signal } = input;
  signal.throwIfAborted();
  const directory = join(input.directory, `verify-${randomUUID()}`);
  const sourceDirectory = join(directory, "source");
  await mkdir(sourceDirectory, { recursive: true, mode: 0o700 });
  const output = join(directory, "source.jsonl");
  try {
    for (const [name, file] of [
      ["capture.journal.jsonl", files.journal],
      ...Object.entries(expected.publications ?? {}).map(([role, proof]) => {
        const name = `${role}.publication.json` as (typeof sourcePublicationMembers)[number];
        const file = files[name];
        if (
          !file ||
          file.bytes !== Number(proof.receipt.bytes) ||
          file.sha256 !== proof.receipt.sha256
        )
          throw new CatalogError("INVALID_PACKAGE", "Publication proof differs from inventory");
        return [name, file] as const;
      }),
    ] as const) {
      await copyImportedFile(file.path, join(sourceDirectory, name), signal, file, 268_435_456);
    }
    const derived = await input.exportSource(
      sourceDirectory,
      output,
      signal,
      canonical,
      input.lifetime,
    );
    const { file: _file, ...receipt } = derived;
    const handle = await open(output, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const digest = await hashFile(handle, derived.bytes, signal);
      if (
        digest.sha256 !== files.normalized.sha256 ||
        derived.bytes !== files.normalized.bytes ||
        !isDeepStrictEqual(receipt, expected)
      )
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Canonical verification differs from retained evidence",
        );
    } finally {
      await handle.close();
    }
    for await (const row of sourceEvidenceRecords(output, derived, signal)) {
      signal.throwIfAborted();
      if (row.event === "audioAcquired") input.audio(row);
    }
    signal.throwIfAborted();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
