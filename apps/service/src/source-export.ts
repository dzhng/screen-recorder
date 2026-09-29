import { mediaProbeSchema } from "@screenrec/core/assets";
import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "@screenrec/core/catalog";
import { fileIdentity } from "@screenrec/core/files";
import type { SourceExporter } from "@screenrec/core/processing";
import type { SourceEvidenceReceipt } from "@screenrec/core/evidence";
import { nativeResult, type MediaWorker } from "./worker.js";

/** Native verifies canonical bytes through the admitted inode, never a reopened donor path. */
export function sourceExporter(
  worker: MediaWorker,
  lifetime?: { readonly fd: number },
): SourceExporter {
  return async (directory, output, signal, canonical, acquisitionLifetime) => {
    const lifetimes = [lifetime, acquisitionLifetime].flatMap((value) => (value ? [value.fd] : []));
    const handles: FileHandle[] = [];
    const inputs: Record<string, string> = {};
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
            descriptors: [...handles.map((file) => file.fd), ...lifetimes],
          },
        ),
      ) as SourceEvidenceReceipt;
    } finally {
      await Promise.all(handles.map((file) => file.close()));
    }
  };
}
