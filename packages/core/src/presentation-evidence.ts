import { constants, type BigIntStats } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { z } from "zod";
import { isAbsolute } from "node:path";
import { CatalogError } from "./library.js";
import { renderPlan, type TimelineRevision } from "./timeline.js";

const recordBytes = 65_536;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timeSchema = z.strictObject({
  value: z
    .string()
    .regex(/^(0|[1-9]\d{0,18})$/)
    .refine((v) => BigInt(v) <= 9_223_372_036_854_775_807n),
  timescale: integer.min(1).max(2_147_483_647),
});
type ExactTime = z.infer<typeof timeSchema>;
function compare(a: ExactTime, b: ExactTime) {
  const delta = BigInt(a.value) * BigInt(b.timescale) - BigInt(b.value) * BigInt(a.timescale);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
const micros = (value: number): ExactTime => ({ value: String(value), timescale: 1_000_000 });
const rounded = (time: ExactTime) =>
  Number(
    (BigInt(time.value) * 2_000_000n + BigInt(time.timescale)) / (2n * BigInt(time.timescale)),
  );
const interval = { spanIndex: integer, start: timeSchema, end: timeSchema };
const pictureSchema = z.strictObject({
  ...interval,
  empty: z.literal(false),
  sampleTime: timeSchema,
  actualSourceUs: integer,
  width: integer.min(1).max(64),
  height: integer.min(1).max(64),
  rgbBase64: z.string().max(16_384),
});
const emptySchema = z.strictObject({ ...interval, empty: z.literal(true) });
const rowSchema = z.discriminatedUnion("empty", [pictureSchema, emptySchema]);
export type PresentationPicture = Readonly<z.infer<typeof pictureSchema>>;
export type PresentationRecord =
  | PresentationPicture
  | Readonly<z.infer<typeof emptySchema> & { actualSourceUs: null }>;
const headerSchema = z.strictObject({
  version: z.literal(1),
  sourceWidth: integer.min(1).max(8192),
  sourceHeight: integer.min(1).max(8192),
  durationUs: integer.positive(),
  spanCount: integer.min(1).max(10_000),
});
const receiptSchema = headerSchema.omit({ spanCount: true }).extend({
  file: z.string().refine(isAbsolute),
  records: integer.positive(),
  bytes: integer.positive(),
});
export type PresentationReceipt = z.infer<typeof receiptSchema>;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) invalid("Malformed presentation evidence");
  return result.data;
}

/** A pinned immutable file with bounded forward readers, not an in-memory raster index. */
export class PresentationEvidence {
  private closed = false;
  private constructor(
    private readonly file: FileHandle,
    private readonly stat: BigIntStats,
    readonly receipt: Readonly<PresentationReceipt>,
    readonly revision: TimelineRevision,
  ) {}
  static async open(receipt: PresentationReceipt, revision: TimelineRevision, signal: AbortSignal) {
    const metadata = Object.freeze(parse(receiptSchema, receipt));
    signal.throwIfAborted();
    const file = await open(
      metadata.file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await file.stat({ bigint: true });
      if (!stat.isFile() || stat.size !== BigInt(metadata.bytes))
        invalid("Presentation receipt does not match its file");
      const pinned = Object.freeze({
        ...revision,
        spans: Object.freeze(revision.spans.map((span) => Object.freeze({ ...span }))),
      });
      const source = new PresentationEvidence(file, stat, metadata, pinned);
      // Admission validates the complete stream without retaining an index or its rasters.
      const validation = source.records(signal);
      while (!(await validation.next()).done) {}
      return source;
    } catch (error) {
      await file.close();
      throw error;
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.file.close();
  }
  private async check(signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.closed) throw new CatalogError("UNAVAILABLE", "Presentation evidence is closed");
    const current = await this.file.stat({ bigint: true });
    if (
      current.size !== this.stat.size ||
      current.mtimeNs !== this.stat.mtimeNs ||
      current.ctimeNs !== this.stat.ctimeNs
    )
      invalid("Opened presentation evidence changed");
  }
  private async *lines(signal: AbortSignal): AsyncGenerator<unknown> {
    const chunk = Buffer.alloc(recordBytes),
      line = Buffer.alloc(recordBytes);
    let position = 0,
      used = 0;
    while (position < this.receipt.bytes) {
      await this.check(signal);
      const { bytesRead } = await this.file.read(
        chunk,
        0,
        Math.min(recordBytes, this.receipt.bytes - position),
        position,
      );
      if (!bytesRead) invalid("Truncated presentation evidence");
      position += bytesRead;
      let start = 0;
      while (start < bytesRead) {
        const found = chunk.indexOf(10, start);
        const end = found < 0 || found >= bytesRead ? bytesRead : found;
        const length = end - start;
        if (used + length + 1 > recordBytes) invalid("Presentation record exceeds its byte bound");
        chunk.copy(line, used, start, end);
        used += length;
        if (end < bytesRead) {
          signal.throwIfAborted();
          let value: unknown;
          try {
            value = JSON.parse(
              new TextDecoder("utf-8", { fatal: true }).decode(line.subarray(0, used)),
            );
          } catch {
            invalid("Malformed presentation JSONL");
          }
          used = 0;
          yield value;
        }
        start = end + 1;
      }
    }
    if (used) invalid("Unterminated presentation record");
  }
  private async *records(signal: AbortSignal): AsyncGenerator<PresentationRecord> {
    let header = false,
      spanIndex = 0,
      count = 0;
    const plan = renderPlan(this.revision);
    let through = micros(plan[0]!.source.startUs);
    let previous: PresentationPicture | null = null;
    for await (const value of this.lines(signal)) {
      if (!header) {
        const h = parse(headerSchema, value);
        if (
          h.durationUs !== this.revision.durationUs ||
          h.spanCount !== plan.length ||
          h.sourceWidth !== this.receipt.sourceWidth ||
          h.sourceHeight !== this.receipt.sourceHeight ||
          h.durationUs !== this.receipt.durationUs
        )
          invalid("Presentation header belongs to another plan or source");
        header = true;
        continue;
      }
      const row = parse(rowSchema, value),
        span = plan[spanIndex];
      if (
        !span ||
        row.spanIndex !== spanIndex ||
        compare(row.start, through) !== 0 ||
        compare(row.end, row.start) <= 0 ||
        compare(row.end, micros(span.source.endUs)) > 0
      )
        invalid("Presentation records must cover each kept span exactly once");
      if (!row.empty) {
        const bytes = Buffer.from(row.rgbBase64, "base64");
        const scale = Math.min(
          1,
          64 / Math.max(this.receipt.sourceWidth, this.receipt.sourceHeight),
        );
        if (
          compare(row.sampleTime, row.start) > 0 ||
          rounded(row.sampleTime) !== row.actualSourceUs ||
          row.width !== Math.max(1, Math.round(this.receipt.sourceWidth * scale)) ||
          row.height !== Math.max(1, Math.round(this.receipt.sourceHeight * scale)) ||
          bytes.length !== row.width * row.height * 3 ||
          bytes.toString("base64") !== row.rgbBase64
        )
          invalid("Invalid supported presentation picture");
        if (
          previous &&
          (compare(row.sampleTime, previous.sampleTime) < 0 ||
            (compare(row.sampleTime, previous.sampleTime) === 0 &&
              row.rgbBase64 !== previous.rgbBase64))
        )
          invalid("Presentation pictures must progress without changing held pixels");
        previous = row;
      }
      through = row.end;
      if (compare(through, micros(span.source.endUs)) === 0) {
        spanIndex++;
        if (plan[spanIndex]) through = micros(plan[spanIndex]!.source.startUs);
      }
      count++;
      if (count > this.receipt.records) invalid("Presentation receipt omits records");
      Object.freeze(row.start);
      Object.freeze(row.end);
      if (!row.empty) Object.freeze(row.sampleTime);
      yield Object.freeze(row.empty ? { ...row, actualSourceUs: null } : row);
    }
    if (!header || spanIndex !== plan.length || count !== this.receipt.records)
      invalid("Incomplete presentation coverage");
    await this.check(signal);
  }
  cursor(signal: AbortSignal) {
    // Each cursor retains only its current bounded record and independent file offset.
    let iterator: AsyncGenerator<PresentationRecord> | undefined,
      current: PresentationRecord | undefined;
    let lastSpan = -1,
      lastUs = -1;
    let running = false;
    return {
      at: async (spanIndex: number, sourceUs: number): Promise<PresentationRecord> => {
        if (running)
          throw new CatalogError(
            "INVALID_RANGE",
            "Presentation cursor requests must be sequential",
          );
        running = true;
        try {
          await this.check(signal);
          const span = this.revision.spans[spanIndex];
          if (
            !Number.isSafeInteger(spanIndex) ||
            !Number.isSafeInteger(sourceUs) ||
            !span ||
            sourceUs < span.startUs ||
            sourceUs >= span.endUs
          )
            throw new CatalogError("INVALID_RANGE", "Presentation request escapes its kept span");
          if (spanIndex < lastSpan || (spanIndex === lastSpan && sourceUs < lastUs))
            throw new CatalogError("INVALID_RANGE", "Presentation cursor cannot move backwards");
          iterator ??= this.records(signal);
          const at = micros(sourceUs);
          while (!current || current.spanIndex < spanIndex || compare(current.end, at) <= 0) {
            signal.throwIfAborted();
            const next = await iterator.next();
            if (next.done) invalid("No presentation supports the requested moment");
            current = next.value;
          }
          if (current.spanIndex !== spanIndex || compare(current.start, at) > 0)
            invalid("No presentation supports the requested moment");
          lastSpan = spanIndex;
          lastUs = sourceUs;
          return current;
        } finally {
          running = false;
        }
      },
    };
  }
}
