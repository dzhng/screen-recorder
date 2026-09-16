import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { z } from "zod";
import { CatalogError } from "./library.js";
import { validateRecord, type EvidenceIdentity, type RecordRow } from "./evidence.js";
import {
  SourceEvidenceReader,
  compareRecordKeys,
  evidenceIndexes,
  recordKey,
  type EvidenceIndex,
  type RecordQuery,
} from "./evidence-read.js";

const pageBytes = 1_048_576,
  metadataBytes = 4_194_304,
  maxPages = 8192;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const keySchema = z.array(integer).min(1).max(2);
const descriptorSchema = z.strictObject({
  file: z.string().regex(/^\d+\.json$/),
  first: keySchema,
  last: keySchema,
  rows: integer.min(1).max(256),
  bytes: integer.min(1).max(pageBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const identitySchema = z.strictObject({
  recordingId: z.string().min(1).max(256),
  sourceId: z.string().min(1).max(256),
  generation: z.string().min(1).max(256),
});
const manifestSchema = z.strictObject({
  version: z.literal(1),
  identity: identitySchema,
  indexes: z.record(z.enum(evidenceIndexes), z.array(descriptorSchema).max(maxPages)),
});
type Descriptor = z.infer<typeof descriptorSchema>;
const rowSchema = z.strictObject({
  sequence: integer.min(1),
  event: z.string(),
  sourceUs: integer.nullable(),
  content: z.string().max(65536),
});
const rowsSchema = z.array(rowSchema).min(1).max(256);
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function parse<T>(schema: z.ZodType<T>, bytes: Buffer): T {
  try {
    return schema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    return invalid("Malformed source evidence page or manifest");
  }
}
/** Reads one bounded regular member. Full archive/root lifetime containment belongs to the package owner. */
function readMember(root: string, file: string, limit: number): Buffer {
  const fd = openSync(
    join(root, file),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > limit)
      invalid("Source evidence member exceeds its read budget");
    const buffer = Buffer.alloc(stat.size + 1);
    let bytes = 0,
      n: number;
    while ((n = readSync(fd, buffer, bytes, buffer.length - bytes, null)) > 0) bytes += n;
    if (bytes !== stat.size) invalid("Source evidence member changed during read");
    return buffer.subarray(0, bytes);
  } finally {
    closeSync(fd);
  }
}
function matches(index: EvidenceIndex, row: RecordRow, data: Record<string, unknown>): boolean {
  if (index === "cursor" || index === "cursorSequence") return row.event === "cursorSample";
  if (index === "geometry") return row.event === "geometry" && row.sourceUs !== null;
  if (index === "geometryEpoch") return row.event === "geometry";
  if (index === "unplaced") return row.event === "geometry" && row.sourceUs === null;
  if (index === "pauses") return row.event === "pause";
  return row.event === "audioAcquired" && data.role === index;
}

/** Producer uses published normalized evidence; absent manifest leaves an interrupted export unreadable. */
export async function writeSourceEvidencePages(
  reader: SourceEvidenceReader,
  identity: EvidenceIdentity,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  identitySchema.parse(identity);
  signal?.throwIfAborted();
  await mkdir(directory);
  const indexes = {} as Record<EvidenceIndex, Descriptor[]>;
  let count = 0;
  for (const index of evidenceIndexes) {
    indexes[index] = [];
    let rows: RecordRow[] = [],
      bytes = 2;
    const flush = async () => {
      if (!rows.length) return;
      signal?.throwIfAborted();
      if (++count > maxPages)
        throw new CatalogError("LIMIT_EXCEEDED", "Too many portable evidence pages");
      const body = Buffer.from(JSON.stringify(rows));
      const file = `${count}.json`;
      await writeFile(join(directory, file), body, { flag: "wx", signal });
      indexes[index].push({
        file,
        first: recordKey(index, rows[0]!),
        last: recordKey(index, rows.at(-1)!),
        rows: rows.length,
        bytes: body.length,
        sha256: hash(body),
      });
      rows = [];
      bytes = 2;
    };
    for (const batch of reader.exportRecords(identity, index)) {
      for (const row of batch) {
        const size = Buffer.byteLength(JSON.stringify(row)) + 1;
        if (size + 2 > pageBytes)
          throw new CatalogError("LIMIT_EXCEEDED", "Portable evidence record exceeds page budget");
        if (rows.length === 256 || bytes + size > pageBytes) await flush();
        rows.push(row);
        bytes += size;
      }
      await setImmediate(undefined, { signal });
    }
    await flush();
  }
  signal?.throwIfAborted();
  const body = Buffer.from(JSON.stringify({ version: 1, identity, indexes }));
  if (body.length > metadataBytes)
    throw new CatalogError("LIMIT_EXCEEDED", "Portable evidence metadata exceeds budget");
  await writeFile(join(directory, "source-pages.pending"), body, { flag: "wx", signal });
  signal?.throwIfAborted();
  await rename(join(directory, "source-pages.pending"), join(directory, "source-pages.json"));
}

/** Internal directory reader: no library, SQLite, mutable recording, or evidence reconstruction. */
export class FileSourceEvidence extends SourceEvidenceReader {
  private readonly manifest: z.infer<typeof manifestSchema>;
  constructor(
    private readonly root: string,
    identity: EvidenceIdentity,
  ) {
    super();
    this.manifest = parse(manifestSchema, readMember(root, "source-pages.json", metadataBytes));
    this.requireComplete(identity);
    let count = 0;
    const files = new Set<string>();
    for (const index of evidenceIndexes) {
      let previous: number[] | undefined;
      for (const page of this.manifest.indexes[index]) {
        if (++count > maxPages || files.has(page.file))
          invalid("Duplicate or excessive evidence pages");
        files.add(page.file);
        const width = index === "cursorSequence" || index === "unplaced" ? 1 : 2;
        if (
          page.first.length !== width ||
          page.last.length !== width ||
          compareRecordKeys(page.first, page.last) > 0 ||
          (previous && compareRecordKeys(previous, page.first) >= 0)
        )
          invalid("Unordered evidence page boundaries");
        previous = page.last;
      }
    }
  }
  protected requireComplete(identity: EvidenceIdentity): void {
    const expected = this.manifest.identity;
    if (
      identity.recordingId !== expected.recordingId ||
      identity.sourceId !== expected.sourceId ||
      identity.generation !== expected.generation
    )
      throw new CatalogError("NOT_READY", "Evidence generation is not indexed");
  }
  private pageRows(index: EvidenceIndex, descriptor: Descriptor): RecordRow[] {
    const bytes = readMember(this.root, descriptor.file, pageBytes);
    if (bytes.length !== descriptor.bytes || hash(bytes) !== descriptor.sha256)
      invalid("Source evidence page differs from its descriptor");
    const rows = parse(rowsSchema, bytes);
    if (rows.length !== descriptor.rows) invalid("Source evidence page row count differs");
    let previous: number[] | undefined;
    for (const row of rows) {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(row.content);
        validateRecord(row.event, data);
      } catch {
        invalid("Invalid normalized page record");
      }
      if (
        !matches(index, row, data) ||
        row.sourceUs !== (data.sourceUs ?? data.atSourceUs ?? data.startUs ?? null)
      )
        invalid("Evidence page record belongs to a different index");
      const key = recordKey(index, row);
      if (previous && compareRecordKeys(previous, key) >= 0)
        invalid("Unordered source evidence page");
      previous = key;
    }
    if (
      compareRecordKeys(descriptor.first, recordKey(index, rows[0]!)) !== 0 ||
      compareRecordKeys(descriptor.last, recordKey(index, rows.at(-1)!)) !== 0
    )
      invalid("Source evidence page boundaries differ");
    return rows;
  }
  protected records(identity: EvidenceIdentity, query: RecordQuery): RecordRow[] {
    this.requireComplete(identity);
    const pages = this.manifest.indexes[query.index];
    const result: RecordRow[] = [];
    const before = (key: readonly number[]) =>
      query.lower &&
      (compareRecordKeys(key, query.lower.key) < 0 ||
        (!query.lower.inclusive && compareRecordKeys(key, query.lower.key) === 0));
    const after = (key: readonly number[]) =>
      query.upper &&
      (compareRecordKeys(key, query.upper.key) > 0 ||
        (!query.upper.inclusive && compareRecordKeys(key, query.upper.key) === 0));
    // Binary search the first page that can contribute, in the requested direction.
    let low = 0,
      high = pages.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (query.reverse ? !after(pages[mid]!.first) : before(pages[mid]!.last)) low = mid + 1;
      else high = mid;
    }
    for (
      let i = query.reverse ? low - 1 : low;
      i >= 0 && i < pages.length;
      i += query.reverse ? -1 : 1
    ) {
      const page = pages[i]!;
      if (query.reverse ? before(page.last) : after(page.first)) break;
      const rows = this.pageRows(query.index, page);
      if (query.reverse) rows.reverse();
      for (const row of rows) {
        const key = recordKey(query.index, row);
        if (before(key) || after(key)) continue;
        result.push(row);
        if (result.length === query.limit) return result;
      }
    }
    return result;
  }
}
