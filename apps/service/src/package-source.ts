import { fstatSync } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "@screenrec/core/catalog";
import { fileIdentity, fileSubdirectory, type IdentifiedFile } from "@screenrec/core/files";
import { FileSourceEvidence, readSourceMetadata } from "@screenrec/core/evidence-pages";
import {
  verifySourceEvidence,
  sourcePublicationMembers,
  type SourceAdmissionFiles,
} from "@screenrec/core/source-admission";
import type { SourceExporter } from "@screenrec/core/processing";
import type { RetainedPackage } from "./package-archive.js";
import { portableIdentities } from "./package-media.js";
import { sourceExporter } from "./source-export.js";
import type { MediaWorker } from "./worker.js";

/** Package audio reads consume these pages, so valid raw evidence alone cannot authorize them. */
export async function validatePackageSource(
  context: Pick<RetainedPackage, "manifest" | "files">,
  worker: MediaWorker,
  signal: AbortSignal,
  lifetime: { readonly fd: number },
): Promise<void> {
  const { source, sourceIdentity } = portableIdentities(context.manifest);
  const root = fileSubdirectory(context.files, source.directory);
  const metadata = readSourceMetadata(root, sourceIdentity);
  const normalized = context.manifest.inventory.find(
    (entry) => entry.path === metadata.receipt.file,
  );
  if (!normalized || normalized.role !== "source")
    throw new CatalogError(
      "INVALID_PACKAGE",
      "Source receipt must name its inventoried normalized evidence",
    );
  const leases: ReturnType<typeof context.files.open>[] = [];
  const identify = (path: string): IdentifiedFile & { sha256: string } => {
    const entry = context.manifest.inventory.find((entry) => entry.path === path);
    if (!entry) throw new CatalogError("INVALID_PACKAGE", "Missing source proof member");
    const file = context.files.open(path);
    leases.push(file);
    const stat = fstatSync(file.fd, { bigint: true });
    return {
      path: context.files.path(path),
      bytes: Number(stat.size),
      identity: fileIdentity(stat),
      sha256: entry.sha256,
    };
  };
  try {
    const files: SourceAdmissionFiles = {
      journal: identify("source/capture.journal.jsonl"),
      normalized,
    };
    const canonical: NonNullable<Parameters<SourceExporter>[3]> = {};
    for (const role of ["narration", "system"] as const) {
      const path = `source/${role}.mov`;
      if (context.manifest.inventory.some((entry) => entry.path === path))
        canonical[role] = identify(path);
    }
    for (const name of sourcePublicationMembers) {
      const path = `source/${name}`;
      const declared = context.manifest.inventory.some((entry) => entry.path === path);
      const role = name === "narration.publication.json" ? "narration" : "system";
      if (declared !== Boolean(metadata.receipt.publications?.[role]))
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Publication inventory differs from source proof",
        );
      if (declared) files[name] = identify(path);
    }
    const reader = new FileSourceEvidence(root, sourceIdentity);
    function* rows(role: "narration" | "system") {
      for (const batch of reader.exportRecords(sourceIdentity, role)) yield* batch;
    }
    const expected = { narration: rows("narration"), system: rows("system") };
    const acquired = { narration: false, system: false };
    const { file: _file, ...receipt } = metadata.receipt;
    await verifySourceEvidence({
      directory: dirname(context.files.path("manifest.json")),
      receipt,
      files,
      canonical,
      exportSource: sourceExporter(worker, lifetime),
      signal,
      audio: (row) => {
        const role = (JSON.parse(row.content) as { role: "narration" | "system" }).role;
        acquired[role] = true;
        if (!isDeepStrictEqual(expected[role].next().value, row))
          throw new CatalogError(
            "INVALID_PACKAGE",
            "Portable audio pages differ from verified source support",
          );
      },
    });
    for (const role of ["narration", "system"] as const) {
      const requested =
        metadata.receipt.header?.[role === "narration" ? "microphone" : "systemAudio"];
      const status = acquired[role] ? "acquired" : requested ? "not_acquired" : "not_requested";
      if (context.manifest.acquisition[role] !== status)
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Acquisition status differs from verified source support",
        );
    }
    if (!expected.narration.next().done || !expected.system.next().done)
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Portable audio pages exceed verified source support",
      );
  } finally {
    for (const lease of leases) lease.close();
  }
}
