import { mediaProbeSchema } from "@screenrec/core/assets";
import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { sourcePublicationMembers } from "@screenrec/core/source-admission";
import { publicationDeadlineMs } from "./publication.js";
import { CatalogError } from "@screenrec/core/catalog";
import { fileIdentity } from "@screenrec/core/files";
import type { SourceExporter } from "@screenrec/core/processing";
import type { SourceEvidenceReceipt } from "@screenrec/core/evidence";
import { MAX_MEDIA_TIMEOUT_MS, nativeResult, type MediaWorker } from "./worker.js";

/** Canonical verification budgets segment work separately from file size: a sparse file can
 * be tiny but expensive. Ten minutes is a bounded observation allowance for the measured
 * per-role workload (two sequential roles), not a universal platform timing guarantee. */
async function verificationDeadline(directory: string, canonicalBytes: number | undefined) {
  const published = await Promise.all(
    sourcePublicationMembers.map(async (name) =>
      lstat(join(directory, name)).then(
        (info) => info.isFile(),
        (error) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      ),
    ),
  );
  if (!published.some(Boolean)) return undefined; // Preserve the legacy worker budget.
  const size = async (name: string) => {
    const file = await open(
      join(directory, name),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    ).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!file) return 0;
    try {
      const info = await file.stat();
      return info.isFile() ? info.size : 0;
    } finally {
      await file.close();
    }
  };
  const bytes =
    (await size("capture.journal.jsonl")) +
    (canonicalBytes ?? (await size("narration.mov")) + (await size("system.mov")));
  return Math.min(MAX_MEDIA_TIMEOUT_MS, 600_000 + publicationDeadlineMs(bytes));
}

/** Native verifies canonical bytes through the admitted inode, never a reopened donor path. */
export function sourceExporter(
  worker: MediaWorker,
  lifetime?: { readonly fd: number },
): SourceExporter {
  return async (directory, output, signal, canonical, acquisitionLifetime) => {
    const lifetimes = [lifetime, acquisitionLifetime].flatMap((value) => (value ? [value.fd] : []));
    const handles: FileHandle[] = [];
    const inputs: Record<string, string> = {};
    let canonicalBytes = 0;
    try {
      for (const [role, expected] of Object.entries(canonical ?? {})) {
        const file = await open(
          expected.path,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        handles.push(file);
        const stat = await file.stat({ bigint: true });
        if (
          !stat.isFile() ||
          stat.size !== BigInt(expected.bytes) ||
          !isDeepStrictEqual(fileIdentity(stat), expected.identity)
        )
          throw new CatalogError("SOURCE_CHANGED", "Canonical input changed after admission");
        canonicalBytes += Number(stat.size);
        inputs[role] = `/dev/fd/${handles.length + 2}`;
        if (expected.metadata) {
          const actual = mediaProbeSchema.parse(
            nativeResult(
              await worker(
                "media.probe",
                { path: "/dev/fd/3" },
                { signal, descriptors: [file.fd, ...lifetimes] },
              ),
            ),
          );
          if (!isDeepStrictEqual(actual, expected.metadata))
            throw new CatalogError(
              "INVALID_PACKAGE",
              "Canonical media metadata differs from its immutable bytes",
            );
        }
      }
      const timeoutMs = await verificationDeadline(
        directory,
        canonical === undefined ? undefined : canonicalBytes,
      );
      return nativeResult(
        await worker(
          "media.sourceEvidence",
          {
            directory,
            output,
            ...(canonical === undefined ? {} : { canonical: inputs }),
          },
          {
            signal,
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
            descriptors: [...handles.map((file) => file.fd), ...lifetimes],
          },
        ),
      ) as SourceEvidenceReceipt;
    } finally {
      await Promise.all(handles.map((file) => file.close()));
    }
  };
}
