import { CatalogError } from "./library.js";
import type { EvidenceIdentity, SourceTrailRead } from "./evidence.js";
import { PresentationEvidence, type PresentationPicture } from "./presentation-evidence.js";
import { analyzeSceneObservations } from "./scenes.js";
import { planVisualTrail, type TrailScene } from "./trails.js";
import type { TimeRange } from "./timeline.js";

/** Adapts proven held-picture membership; it never passes these facts through nearest-still validation. */
function pointScene(
  picture: PresentationPicture,
  at: number,
  kept: TimeRange,
  source: PresentationEvidence,
): TrailScene {
  const sample = {
    requestedSourceUs: at,
    actualSourceUs: picture.actualSourceUs,
    distanceUs: Math.abs(at - picture.actualSourceUs),
    width: picture.width,
    height: picture.height,
    rgbBase64: picture.rgbBase64,
  };
  return {
    ...analyzeSceneObservations(
      {
        sourceWidth: source.receipt.sourceWidth,
        sourceHeight: source.receipt.sourceHeight,
        samples: [sample],
      },
      { kept, range: { startUs: at, endUs: at } },
    ),
    reference: sample,
    futureComparison: null,
  };
}

/** Sequential point inspection only. A future movie event planner owns which moments to request. */
export class PresentationPointer {
  private busy = false;
  private readonly current;
  private readonly prior;
  constructor(
    private readonly source: PresentationEvidence,
    private readonly evidence: SourceTrailRead,
    private readonly identity: EvidenceIdentity,
    private readonly signal: AbortSignal,
  ) {
    this.current = source.cursor(signal);
    this.prior = source.cursor(signal);
  }
  async at(spanIndex: number, sourceUs: number) {
    if (this.busy)
      throw new CatalogError("INVALID_RANGE", "Pointer inspection requests must be sequential");
    this.busy = true;
    try {
      return await this.inspect(spanIndex, sourceUs);
    } finally {
      this.busy = false;
    }
  }
  private async inspect(spanIndex: number, sourceUs: number) {
    const record = await this.current.at(spanIndex, sourceUs);
    if (record.empty)
      return {
        kind: "empty" as const,
        requestedSourceUs: sourceUs,
        record,
        pointer: null,
      };
    const kept = this.source.revision.spans[spanIndex]!;
    const plan = await planVisualTrail(
      { kept, requestedSourceUs: sourceUs, trailUs: 0 },
      {
        evidence: this.evidence,
        identity: this.identity,
        scene: pointScene(record, sourceUs, kept, this.source),
        readScene: async (at) => {
          const previous = await this.prior.at(spanIndex, at);
          return previous.empty ? null : pointScene(previous, at, kept, this.source);
        },
      },
      this.signal,
    );
    return { kind: "picture" as const, record, plan };
  }
}
