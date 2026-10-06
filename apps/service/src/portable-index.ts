import { CatalogError } from "@yap/core/catalog";
import { fstatSync, readFileSync } from "node:fs";
import { fileIdentity, type FileAccess } from "@yap/core/files";
import type { IndexRecords, PortableIndexRecord } from "@yap/core/screenshot-index";
import { indexMemberPath, type PortableResource } from "@yap/core/project-package";

type RecordData<D extends IndexRecords> =
  | { kind: "entry"; candidate: D["candidate"]; frame: D["frame"] }
  | { kind: "coverage"; coverage: D["coverage"] };

/** Both index domains consume the same bounded archive framing and retained PNG identity. */
export async function* portableIndexRecords<D extends IndexRecords>(
  files: FileAccess,
  resource: Extract<PortableResource, { kind: "index-generation" | "project-index-generation" }>,
  parse: (value: unknown) => RecordData<D>,
  signal: AbortSignal,
): AsyncGenerator<PortableIndexRecord<D>> {
  for (let ordinal = 0; ordinal < resource.records.length; ordinal++) {
    signal.throwIfAborted();
    const file = files.open(indexMemberPath(resource, "records", ordinal));
    let record;
    try {
      record = parse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file.fd))),
      );
    } catch {
      throw new CatalogError("INVALID_PACKAGE", "Invalid retained screenshot index record");
    } finally {
      file.close();
    }
    if (record.kind === "coverage") {
      yield record;
      continue;
    }
    const path = indexMemberPath(resource, "images", record.candidate.ordinal),
      source = files.open(path);
    try {
      const stat = fstatSync(source.fd, { bigint: true });
      yield {
        ...record,
        source: { path: files.path(path), bytes: Number(stat.size), identity: fileIdentity(stat) },
        sha256: resource.images[record.candidate.ordinal]!.sha256,
      };
    } finally {
      source.close();
    }
  }
}
