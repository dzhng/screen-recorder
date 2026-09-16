import { CatalogError } from "./library.js";
import type {
  ScreenshotIndexIdentity,
  ScreenshotIndexMetadata,
  ScreenshotIndexEntry,
} from "./screenshot-index.js";
import type { SelectionCoverage } from "./selection.js";
export type IndexCoverage = SelectionCoverage & { sequence: number };
export type EntryQuery = { after: number; through?: number; limit: number };
export type CoverageQuery = EntryQuery & { ordinal?: number };
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function limitValue(limit = 50): number {
  if (!integer(limit) || limit < 1 || limit > 200)
    throw new CatalogError("INVALID_PARAMS", "Index page limit must be 1...200");
  return limit;
}
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
/** Entry and coverage continuation semantics shared by live and portable retained indexes. */
export abstract class ScreenshotIndexReader {
  protected abstract readMetadata(identity: ScreenshotIndexIdentity): ScreenshotIndexMetadata;
  protected abstract entryRows(
    identity: ScreenshotIndexIdentity,
    query: EntryQuery,
  ): ScreenshotIndexEntry[];
  protected abstract coverageRows(
    identity: ScreenshotIndexIdentity,
    query: CoverageQuery,
  ): IndexCoverage[];
  protected readEntry(identity: ScreenshotIndexIdentity, ordinal: number): ScreenshotIndexEntry {
    if (!integer(ordinal)) invalid("Invalid candidate ordinal");
    const row = this.entryRows(identity, { after: ordinal - 1, through: ordinal, limit: 1 })[0];
    if (!row) invalid("Unknown selected image");
    return row;
  }
  page({
    identity,
    afterOrdinal,
    limit,
  }: {
    identity: ScreenshotIndexIdentity;
    afterOrdinal?: number;
    limit?: number;
  }) {
    const metadata = this.readMetadata(identity),
      take = limitValue(limit);
    if (afterOrdinal !== undefined) this.readEntry(identity, afterOrdinal);
    const entries = this.entryRows(identity, { after: afterOrdinal ?? -1, limit: take + 1 });
    const more = entries.length > take;
    if (more) entries.pop();
    return { metadata, entries, nextOrdinal: more ? entries.at(-1)!.candidate.ordinal : null };
  }
  coveragePage({
    identity,
    afterSequence,
    candidateOrdinal,
    limit,
  }: {
    identity: ScreenshotIndexIdentity;
    afterSequence?: number;
    candidateOrdinal?: number;
    limit?: number;
  }) {
    this.readMetadata(identity);
    const take = limitValue(limit);
    if (candidateOrdinal !== undefined) this.readEntry(identity, candidateOrdinal);
    if (afterSequence !== undefined) {
      if (!integer(afterSequence)) invalid("Invalid coverage continuation");
      const anchor = this.coverageRows(identity, {
        after: afterSequence - 1,
        through: afterSequence,
        limit: 1,
      })[0];
      if (!anchor || (candidateOrdinal !== undefined && anchor.ordinal !== candidateOrdinal))
        invalid("Coverage continuation is outside this query");
    }
    const coverage = this.coverageRows(identity, {
      after: afterSequence ?? -1,
      ...(candidateOrdinal === undefined ? {} : { ordinal: candidateOrdinal }),
      limit: take + 1,
    });
    const more = coverage.length > take;
    if (more) coverage.pop();
    return { coverage, nextSequence: more ? coverage.at(-1)!.sequence : null };
  }
}
