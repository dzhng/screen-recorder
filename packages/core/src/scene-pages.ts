import { z } from "zod";
import type { FileAccess } from "./files.js";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./library.js";
import {
  SceneEvidenceReader,
  normalizeSceneChunk,
  type SceneEvidenceRead,
  type SceneEvidenceIdentity,
  type SceneEvidenceMetadata,
  type SceneChunkReport,
} from "./scene-evidence.js";
import { scenePolicy } from "./scenes.js";
import { OrderedPages, writeOrderedPages, type OrderedPageCodec } from "./ordered-pages.js";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().min(1).max(256);
const metadataSchema = z.strictObject({
  recordingId: text,
  sourceId: text,
  generation: text,
  policy: text,
  durationUs: integer.positive(),
  sourceWidth: integer.positive(),
  sourceHeight: integer.positive(),
  chunkCount: integer,
  comparisonCount: integer,
  boundaryCount: integer,
});
const range = z.strictObject({ startUs: integer, endUs: integer });
const chunkSchema = z.object({
  policy: z.literal(scenePolicy.id),
  range,
  kept: range,
  sourceWidth: integer.positive(),
  sourceHeight: integer.positive(),
  coverage: z
    .array(
      z.object({
        requestedSourceUs: integer,
        actualSourceUs: integer,
        stillnessRunStartUs: integer,
        distanceUs: integer,
        width: integer.positive().max(64),
        height: integer.positive().max(64),
      }),
    )
    .max(52),
  comparisons: z
    .array(
      z.object({
        previousActualSourceUs: integer,
        actualSourceUs: integer,
        changedPixelFraction: z.number().min(0).max(1),
        changedCellFraction: z.number().min(0).max(1),
        meanAbsoluteChannelDifference: z.number().min(0).max(1),
        boundary: z.boolean(),
      }),
    )
    .max(51),
  boundaries: z.array(z.object({ kind: z.literal("scene"), atSourceUs: integer })).max(51),
});
const codec: OrderedPageCodec<SceneChunkReport, SceneEvidenceMetadata> = {
  metadata: metadataSchema,
  orders: { chunks: 1 },
  decode(value, { metadata }) {
    const chunk = chunkSchema.parse(value);
    if (!isDeepStrictEqual(normalizeSceneChunk(chunk, metadata.durationUs).chunk, chunk))
      throw new CatalogError("INVALID_EVIDENCE", "Scene chunk is not canonical");
    return chunk;
  },
  key: (chunk) => [chunk.range.startUs],
};
export async function writeSceneEvidencePages(
  reader: SceneEvidenceRead,
  identity: SceneEvidenceIdentity,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const first = reader.page({ identity, limit: 1 });
  async function* chunks() {
    let page = first;
    for (;;) {
      yield page.chunks;
      if (page.nextStartUs === null) return;
      page = reader.page({ identity, afterStartUs: page.nextStartUs, limit: 100 });
    }
  }
  await writeOrderedPages(directory, first.metadata, codec, chunks, signal);
}
export class FileSceneEvidence extends SceneEvidenceReader {
  private readonly pages: OrderedPages<SceneChunkReport, SceneEvidenceMetadata>;
  constructor(root: string | FileAccess, identity: SceneEvidenceIdentity) {
    super();
    this.pages = new OrderedPages(root, codec);
    if (this.pages.metadata.policy !== scenePolicy.id)
      throw new CatalogError("UNSUPPORTED_POLICY", "Unsupported portable scene policy");
    if (this.pages.rowCount("chunks") !== this.pages.metadata.chunkCount)
      throw new CatalogError("INVALID_EVIDENCE", "Scene page count differs from its metadata");
    this.readMetadata(identity);
  }
  protected readMetadata(identity: SceneEvidenceIdentity): SceneEvidenceMetadata {
    const { recordingId, sourceId, generation, policy } = this.pages.metadata;
    if (
      !isDeepStrictEqual(
        { recordingId, sourceId, generation, policy },
        {
          recordingId: identity.recordingId,
          sourceId: identity.sourceId,
          generation: identity.generation,
          policy: identity.policy,
        },
      )
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Scene evidence is not complete for this identity",
      );
    return structuredClone(this.pages.metadata);
  }
  protected readChunks(
    identity: SceneEvidenceIdentity,
    afterStartUs: number,
    limit: number,
  ): SceneChunkReport[] {
    const metadata = this.readMetadata(identity);
    const rows = this.pages.read({
      index: "chunks",
      ...(afterStartUs < 0 ? {} : { lower: { key: [afterStartUs], inclusive: false } }),
      limit,
    });
    if (
      rows.some(
        (row) =>
          row.policy !== metadata.policy ||
          row.kept.startUs !== 0 ||
          row.kept.endUs !== metadata.durationUs ||
          row.sourceWidth !== metadata.sourceWidth ||
          row.sourceHeight !== metadata.sourceHeight,
      )
    )
      throw new CatalogError("INVALID_EVIDENCE", "Scene chunk differs from its metadata");
    return rows;
  }
}
