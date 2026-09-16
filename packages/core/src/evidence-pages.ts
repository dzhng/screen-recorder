import { z } from "zod";
import { CatalogError } from "./library.js";
import { validateRecord, type EvidenceIdentity, type RecordRow } from "./evidence.js";
import {
  SourceEvidenceReader,
  evidenceIndexes,
  recordKey,
  type EvidenceIndex,
  type RecordQuery,
} from "./evidence-read.js";
import { OrderedPages, writeOrderedPages, type OrderedPageCodec } from "./ordered-pages.js";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identitySchema = z.strictObject({
  recordingId: z.string().min(1).max(256),
  sourceId: z.string().min(1).max(256),
  generation: z.string().min(1).max(256),
});
const rowSchema = z.strictObject({
  sequence: integer.min(1),
  event: z.string(),
  sourceUs: integer.nullable(),
  content: z.string().max(65536),
});
function matches(index: EvidenceIndex, row: RecordRow, data: Record<string, unknown>): boolean {
  if (index === "cursor" || index === "cursorSequence") return row.event === "cursorSample";
  if (index === "geometry") return row.event === "geometry" && row.sourceUs !== null;
  if (index === "geometryEpoch") return row.event === "geometry";
  if (index === "unplaced") return row.event === "geometry" && row.sourceUs === null;
  if (index === "pauses") return row.event === "pause";
  return row.event === "audioAcquired" && data.role === index;
}

const metadataSchema = z.strictObject({ kind: z.literal("source"), identity: identitySchema });
const codec: OrderedPageCodec<RecordRow, z.infer<typeof metadataSchema>> = {
  metadata: metadataSchema,
  orders: Object.fromEntries(
    evidenceIndexes.map((index) => [
      index,
      index === "cursorSequence" || index === "unplaced" ? 1 : 2,
    ]),
  ),
  decode(value, { index }) {
    const row = rowSchema.parse(value);
    const data = JSON.parse(row.content);
    validateRecord(row.event, data);
    if (
      !matches(index as EvidenceIndex, row, data) ||
      row.sourceUs !== (data.sourceUs ?? data.atSourceUs ?? data.startUs ?? null)
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Evidence page record belongs to a different index",
      );
    return row;
  },
  key: (row, index) => recordKey(index as EvidenceIndex, row),
};
export function writeSourceEvidencePages(
  reader: SourceEvidenceReader,
  identity: EvidenceIdentity,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const { recordingId, sourceId, generation } = identity;
  return writeOrderedPages(
    directory,
    { kind: "source" as const, identity: { recordingId, sourceId, generation } },
    codec,
    (index) => reader.exportRecords(identity, index as EvidenceIndex),
    signal,
  );
}
export class FileSourceEvidence extends SourceEvidenceReader {
  private readonly pages: OrderedPages<RecordRow, z.infer<typeof metadataSchema>>;
  constructor(root: string, identity: EvidenceIdentity) {
    super();
    this.pages = new OrderedPages(root, codec);
    this.requireComplete(identity);
  }
  protected requireComplete(identity: EvidenceIdentity): void {
    const expected = this.pages.metadata.identity;
    if (
      identity.recordingId !== expected.recordingId ||
      identity.sourceId !== expected.sourceId ||
      identity.generation !== expected.generation
    )
      throw new CatalogError("NOT_READY", "Evidence generation is not indexed");
  }
  protected records(identity: EvidenceIdentity, query: RecordQuery): RecordRow[] {
    this.requireComplete(identity);
    return this.pages.read(query);
  }
}
