import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./catalog.js";
import type { ScreenshotIndexReader } from "./screenshot-index-read.js";
import type {
  IndexRecords,
  ScreenshotIndexMetadata,
  ScreenshotIndexStore,
} from "./screenshot-index.js";

export type IndexReadReference = { generation: string };
export type IndexReadCursor<R> = R & { afterOrdinal: number };
export type IndexCoverageCursor<R> = R & { afterSequence: number; candidateOrdinal: number | null };
type CoverageInput<R> = {
  candidateOrdinal?: number | undefined;
  cursor?: IndexCoverageCursor<R> | undefined;
  limit?: number | undefined;
};
type Reader<D extends IndexRecords> = Pick<
  ScreenshotIndexReader<D>,
  "page" | "coveragePage" | "readEntry"
> & {
  openRead(
    identity: D["identity"],
    ordinal: number,
  ): ReturnType<ScreenshotIndexStore<D>["openRead"]>;
};

export function validateIndexCoverageCursor<R extends IndexReadReference>(
  reference: R,
  input: CoverageInput<R>,
): void {
  if (!input.cursor) return;
  const { afterSequence: _after, candidateOrdinal, ...cursorReference } = input.cursor;
  if (
    !isDeepStrictEqual(reference, cursorReference) ||
    candidateOrdinal !== (input.candidateOrdinal ?? null)
  )
    throw new CatalogError(
      "ARTIFACT_CHANGED",
      "Coverage continuation belongs to another index or filter",
    );
}

/** Read-only formatting over an admitted retained generation; callers own target resolution/publication. */
export class RetainedIndexRead<
  R extends IndexReadReference,
  D extends IndexRecords = IndexRecords,
> {
  private readonly metadata: ScreenshotIndexMetadata<D>;
  private readonly reference: R;
  constructor(
    private readonly reader: Reader<D>,
    metadata: ScreenshotIndexMetadata<D>,
    reference: R,
  ) {
    if (
      Object.entries(reference).some(
        ([key, value]) =>
          Reflect.has(metadata, key) && !isDeepStrictEqual(value, Reflect.get(metadata, key)),
      )
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Index reference does not match retained metadata",
      );
    this.metadata = structuredClone(metadata);
    this.reference = structuredClone(reference);
  }
  get(input: { cursor?: IndexReadCursor<R> | undefined; limit?: number | undefined } = {}) {
    if (input.cursor) {
      const { afterOrdinal: _after, ...reference } = input.cursor;
      if (!isDeepStrictEqual(reference, this.reference))
        throw new CatalogError(
          "ARTIFACT_CHANGED",
          "Index continuation belongs to another target or revision",
        );
    }
    const page = this.reader.page({
      identity: this.metadata,
      ...(input.cursor ? { afterOrdinal: input.cursor.afterOrdinal } : {}),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    });
    const reference = structuredClone(this.reference);
    return {
      ...reference,
      state: "ready" as const,
      page: {
        metadata: page.metadata,
        entries: page.entries.map((entry) => ({
          ...entry,
          reference: { ...reference, ordinal: entry.candidate.ordinal },
        })),
        nextCursor:
          page.nextOrdinal === null ? null : { ...reference, afterOrdinal: page.nextOrdinal },
      },
    };
  }
  coverage(input: CoverageInput<R> = {}) {
    validateIndexCoverageCursor(this.reference, input);
    const page = this.reader.coveragePage({
      identity: this.metadata,
      ...(input.candidateOrdinal === undefined ? {} : { candidateOrdinal: input.candidateOrdinal }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
      ...(input.cursor ? { afterSequence: input.cursor.afterSequence } : {}),
    });
    const reference = structuredClone(this.reference);
    return {
      ...reference,
      coverage: page.coverage,
      nextCursor:
        page.nextSequence === null
          ? null
          : {
              ...reference,
              candidateOrdinal: input.candidateOrdinal ?? null,
              afterSequence: page.nextSequence,
            },
    };
  }
  frame(ordinal: number) {
    const entry = this.reader.readEntry(this.metadata, ordinal);
    return {
      ...structuredClone(this.reference),
      ordinal,
      state: "ready" as const,
      published: { frame: entry.frame },
      candidate: entry.candidate,
      coverageCount: entry.coverageCount,
    };
  }
  openRead(ordinal: number) {
    return this.reader.openRead(this.metadata, ordinal);
  }
}
