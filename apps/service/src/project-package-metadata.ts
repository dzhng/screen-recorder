import { setImmediate } from "node:timers/promises";
import { CatalogError } from "@yap/core/catalog";
import { retainedFileRead, type FileAccess } from "@yap/core/files";
import { archiveLimits } from "@yap/core/package-archive";
import {
  resolveProjectPackage,
  type ProjectPackageManifest,
} from "@yap/core/project-package";

/** Only admitted extraction descriptors can hydrate metadata before project readiness. */
export async function resolveProjectPackageMetadata(
  input: {
    manifest: ProjectPackageManifest;
    revisions: ReadonlyMap<string, string>;
    files: FileAccess;
  },
  signal?: AbortSignal,
) {
  const metadata = new Map<string, string>(),
    revisions = new Map<string, string>();
  const inventory = new Map(input.manifest.inventory.map((entry) => [entry.path, entry]));
  const members = [
    ...input.manifest.revisions.map((path) => ({
      ref: inventory.get(path)!,
      destination: revisions,
    })),
    ...input.manifest.resources.map((resource) => ({
      ref: resource.metadata,
      destination: metadata,
    })),
  ];
  for (const { ref, destination } of members) {
    signal?.throwIfAborted();
    const reader = retainedFileRead(input.files.open(ref.path), ref.bytes);
    try {
      const bytes = Buffer.allocUnsafe(ref.bytes);
      for (let position = 0; position < bytes.length;) {
        signal?.throwIfAborted();
        const count = reader.read(
          bytes.subarray(position, Math.min(bytes.length, position + 65536)),
          position,
        );
        if (count <= 0)
          throw new CatalogError("INVALID_PACKAGE", "Project JSON member is truncated");
        position += count;
        await setImmediate();
      }
      signal?.throwIfAborted();
      try {
        destination.set(ref.path, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new CatalogError("INVALID_PACKAGE", "Project JSON member is not UTF-8");
      }
    } finally {
      reader.release();
    }
  }
  signal?.throwIfAborted();
  return resolveProjectPackage(input.manifest, revisions, archiveLimits, metadata);
}
