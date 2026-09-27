import { retainedFileRead } from "./files.js";
import { z } from "zod";
import { createHash } from "node:crypto";
import { readSync } from "node:fs";
import { fileAccess, type FileAccess } from "./files.js";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./catalog.js";
import {
  validateIndexEntry,
  type ScreenshotIndexIdentity,
  type ScreenshotIndexMetadata,
  type ScreenshotIndexEntry,
  type ScreenshotIndexStore,
} from "./screenshot-index.js";
import {
  ScreenshotIndexReader,
  type EntryQuery,
  type CoverageQuery,
  type IndexCoverage,
} from "./screenshot-index-read.js";
import { type MaterializedFrame, framePolicy } from "./frame-materialization.js";
import { selectionPolicy } from "./selection.js";
import { scenePolicy } from "./scenes.js";
import { trailPolicy } from "./trails.js";
import { type TimelineRevision, sourceToEdited } from "./timeline.js";
import { openRetainedImage } from "./retained-image.js";
import { OrderedPages, writeOrderedPages, type OrderedPageCodec } from "./ordered-pages.js";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  text = z.string().min(1).max(256);
const sourceIdentity = z.strictObject({ recordingId: text, sourceId: text, generation: text });
const identitySchema = sourceIdentity
  .extend({
    revisionId: text,
    sourceIdentity,
    sceneIdentity: sourceIdentity.extend({ policy: text }),
    selectionPolicy: text,
    framePolicy: text,
    trailPolicy: text,
  })
  .strip();
const metadataSchema = identitySchema.extend({
  durationUs: integer,
  candidateCount: integer,
  coverageCount: integer,
  bytes: integer,
});
const imageSchema = z.strictObject({
  file: z.string().regex(/^images\/\d+\.png$/),
  bytes: integer.min(33).max(32 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const range = z.strictObject({ startUs: integer, endUs: integer });
const coverageSchema = z.strictObject({
  kind: z.literal("coverage"),
  ordinal: integer,
  sequence: integer,
  source: range,
  playback: range,
  equality: z.enum(["sampled", "unproven"]),
});
type PortableEntry = Omit<ScreenshotIndexEntry, "frame"> & {
  frame: Omit<MaterializedFrame, "file">;
  image: z.infer<typeof imageSchema>;
};
type Row = { kind: "entry"; entry: PortableEntry } | { kind: "coverage"; coverage: IndexCoverage };
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function pinned(identity: ScreenshotIndexIdentity): ScreenshotIndexIdentity {
  return identitySchema.parse(identity);
}
function codec(
  revision: TimelineRevision,
  resolveImage: (file: string) => string,
): OrderedPageCodec<Row, ScreenshotIndexMetadata> {
  return {
    metadata: metadataSchema,
    orders: { entries: 1, coverage: 1, candidateCoverage: 2 },
    decode(value, { index, metadata }) {
      if (!value || typeof value !== "object") invalid("Invalid retained index row");
      const row = value as Row;
      if (index === "entries") {
        if (row.kind !== "entry" || !row.entry?.frame || "file" in row.entry.frame)
          invalid("Portable frames require an image reference, not an original path");
        const image = imageSchema.parse(row.entry.image),
          frame = row.entry.frame;
        if (
          !Number.isSafeInteger(row.entry.candidate.ordinal) ||
          row.entry.candidate.ordinal < 0 ||
          row.entry.candidate.ordinal >= metadata.candidateCount ||
          image.file !== `images/${row.entry.candidate.ordinal}.png` ||
          image.bytes !== frame.bytes ||
          !Number.isSafeInteger(row.entry.coverageCount) ||
          row.entry.coverageCount < 0
        )
          invalid("Invalid portable image receipt");
        if (
          !Number.isSafeInteger(frame.width) ||
          frame.width < 1 ||
          !Number.isSafeInteger(frame.height) ||
          frame.height < 1 ||
          frame.mediaType !== "image/png" ||
          typeof frame.clean !== "boolean"
        )
          invalid("Invalid portable frame dimensions or mode");
        validateIndexEntry(
          metadata,
          revision,
          row.entry.candidate,
          { ...frame, file: resolveImage(image.file) },
          resolveImage(image.file),
        );
      } else {
        if (row.kind !== "coverage") invalid("Wrong retained index order");
        const coverage = coverageSchema.parse(row.coverage);
        if (
          coverage.ordinal >= metadata.candidateCount ||
          coverage.playback.endUs <= coverage.playback.startUs ||
          coverage.source.endUs <= coverage.source.startUs ||
          coverage.playback.endUs > revision.durationUs ||
          coverage.source.endUs - coverage.source.startUs !==
            coverage.playback.endUs - coverage.playback.startUs ||
          sourceToEdited(revision, coverage.source.startUs) !== coverage.playback.startUs ||
          sourceToEdited(revision, coverage.source.endUs - 1) !== coverage.playback.endUs - 1
        )
          invalid("Coverage is outside the pinned revision");
      }
      return row;
    },
    key(row, index) {
      if (row.kind === "entry") return [row.entry.candidate.ordinal];
      return index === "candidateCoverage"
        ? [row.coverage.ordinal, row.coverage.sequence]
        : [row.coverage.sequence];
    },
  };
}
async function copyImage(
  index: Pick<ScreenshotIndexStore, "openRead">,
  identity: ScreenshotIndexIdentity,
  ordinal: number,
  directory: string,
  signal?: AbortSignal,
) {
  const source = index.openRead(identity, ordinal),
    file = `images/${ordinal}.png`;
  let output: Awaited<ReturnType<typeof open>> | undefined;
  try {
    output = await open(join(directory, file), "wx");
    const buffer = Buffer.alloc(65536),
      hash = createHash("sha256");
    for (let position = 0; position < source.bytes;) {
      signal?.throwIfAborted();
      const bytes = source.read(buffer, position);
      if (!bytes) invalid("Retained image ended during copy");
      const part = buffer.subarray(0, bytes);
      hash.update(part);
      await output.writeFile(part);
      position += bytes;
    }
    return { file, bytes: source.bytes, sha256: hash.digest("hex") };
  } finally {
    source.release();
    await output?.close();
  }
}
export async function writeScreenshotIndexPages(
  index: Pick<ScreenshotIndexStore, "page" | "coveragePage" | "openRead">,
  identity: ScreenshotIndexIdentity,
  revision: TimelineRevision,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const first = index.page({ identity, limit: 1 }),
    metadata = first.metadata;
  if (identity.revisionId !== revision.id || metadata.durationUs !== revision.durationUs)
    invalid("Index revision does not match export");
  async function* batches(order: string): AsyncGenerator<Row[]> {
    if (order === "entries") {
      await mkdir(join(directory, "images"));
      let page = first;
      for (;;) {
        const rows: Row[] = [];
        for (const entry of page.entries) {
          const { file, ...frame } = entry.frame;
          if (!file) invalid("Retained frame has no source file");
          rows.push({
            kind: "entry",
            entry: {
              ...entry,
              frame,
              image: await copyImage(index, identity, entry.candidate.ordinal, directory, signal),
            },
          });
        }
        yield rows;
        if (page.nextOrdinal === null) return;
        page = index.page({ identity, afterOrdinal: page.nextOrdinal, limit: 50 });
      }
    }
    const count = order === "coverage" ? 1 : metadata.candidateCount;
    for (let candidate = 0; candidate < count; candidate++) {
      const ordinal = order === "coverage" ? undefined : candidate;
      let afterSequence: number | undefined;
      for (;;) {
        const page = index.coveragePage({
          identity,
          ...(ordinal === undefined ? {} : { candidateOrdinal: ordinal }),
          ...(afterSequence === undefined ? {} : { afterSequence }),
        });
        yield page.coverage.map((coverage) => ({ kind: "coverage" as const, coverage }));
        if (page.nextSequence === null) break;
        afterSequence = page.nextSequence;
      }
    }
  }
  await writeOrderedPages(
    directory,
    metadata,
    codec(revision, (file) => join(directory, file)),
    batches,
    signal,
  );
}
export class FileScreenshotIndex extends ScreenshotIndexReader {
  private readonly pages: OrderedPages<Row, ScreenshotIndexMetadata>;
  private readonly root: FileAccess;
  constructor(
    root: string | FileAccess,
    identity: ScreenshotIndexIdentity,
    revision: TimelineRevision,
  ) {
    super();
    this.root = fileAccess(root);
    this.pages = new OrderedPages(
      this.root,
      codec(revision, (file) => this.root.path(file)),
    );
    const metadata = this.pages.metadata;
    if (
      metadata.selectionPolicy !== selectionPolicy.id ||
      metadata.framePolicy !== framePolicy ||
      metadata.trailPolicy !== trailPolicy.id ||
      metadata.sceneIdentity.policy !== scenePolicy.id
    )
      throw new CatalogError("UNSUPPORTED_POLICY", "Unsupported portable index policy");
    if (metadata.revisionId !== revision.id || metadata.durationUs !== revision.durationUs)
      invalid("Portable index requires its pinned revision");
    if (
      this.pages.rowCount("entries") !== metadata.candidateCount ||
      this.pages.rowCount("coverage") !== metadata.coverageCount ||
      this.pages.rowCount("candidateCoverage") !== metadata.coverageCount
    )
      invalid("Index page counts differ from their metadata");
    this.readMetadata(identity);
  }
  protected readMetadata(identity: ScreenshotIndexIdentity): ScreenshotIndexMetadata {
    if (!isDeepStrictEqual(pinned(identity), pinned(this.pages.metadata)))
      invalid("Index identity does not match retained generation");
    return structuredClone(this.pages.metadata);
  }
  private portableEntry(identity: ScreenshotIndexIdentity, ordinal: number): PortableEntry {
    this.readMetadata(identity);
    const row = this.pages.read({
      index: "entries",
      lower: { key: [ordinal], inclusive: true },
      upper: { key: [ordinal], inclusive: true },
      limit: 1,
    })[0];
    if (row?.kind !== "entry") invalid("Unknown selected image");
    return row.entry;
  }
  protected entryRows(
    identity: ScreenshotIndexIdentity,
    query: EntryQuery,
  ): ScreenshotIndexEntry[] {
    this.readMetadata(identity);
    return this.pages
      .read({
        index: "entries",
        ...(query.after < 0 ? {} : { lower: { key: [query.after], inclusive: false } }),
        ...(query.through === undefined
          ? {}
          : { upper: { key: [query.through], inclusive: true } }),
        limit: query.limit,
      })
      .map((row) => {
        if (row.kind !== "entry") invalid("Wrong retained entry order");
        return {
          candidate: row.entry.candidate,
          frame: { ...row.entry.frame, file: this.root.path(row.entry.image.file) },
          coverageCount: row.entry.coverageCount,
        };
      });
  }
  protected coverageRows(identity: ScreenshotIndexIdentity, query: CoverageQuery): IndexCoverage[] {
    this.readMetadata(identity);
    const ordinal = query.ordinal,
      prefix = ordinal === undefined ? [] : [ordinal];
    return this.pages
      .read({
        index: ordinal === undefined ? "coverage" : "candidateCoverage",
        ...(query.after < 0 && ordinal === undefined
          ? {}
          : { lower: { key: [...prefix, Math.max(0, query.after)], inclusive: query.after < 0 } }),
        ...(query.through === undefined && ordinal === undefined
          ? {}
          : {
              upper: {
                key: [...prefix, query.through ?? Number.MAX_SAFE_INTEGER],
                inclusive: true,
              },
            }),
        limit: query.limit,
      })
      .map((row) => {
        if (row.kind !== "coverage") invalid("Wrong coverage order");
        return row.coverage;
      });
  }
  openRead(identity: ScreenshotIndexIdentity, ordinal: number) {
    this.readEntry(identity, ordinal);
    const entry = this.portableEntry(identity, ordinal),
      { file } = openRetainedImage(this.root.open(entry.image.file), entry.frame);
    try {
      const hash = createHash("sha256"),
        buffer = Buffer.alloc(65536);
      for (let position = 0; position < entry.image.bytes;) {
        const bytes = readSync(
          file.fd,
          buffer,
          0,
          Math.min(buffer.length, entry.image.bytes - position),
          position,
        );
        if (!bytes) invalid("Portable image ended during verification");
        hash.update(buffer.subarray(0, bytes));
        position += bytes;
      }
      if (hash.digest("hex") !== entry.image.sha256)
        invalid("Portable image differs from its receipt");
      return retainedFileRead(file, entry.image.bytes);
    } catch (error) {
      file.close();
      throw error;
    }
  }
}
