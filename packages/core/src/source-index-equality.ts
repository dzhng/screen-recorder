import type { SourceFrameArtifact } from "./frame-inspection.js";
import type { SceneEvidenceStore } from "./scene-evidence.js";
import type { SourceSceneChunk } from "./source-scene-chunks.js";
import type { SourceIndexIdentity } from "./source-index.js";
import type { TimeRange } from "./presentation-time.js";
import { scenePolicy } from "./scenes.js";
import { compareSceneSampleClocks } from "./source-scenes.js";
import { sourceIndexChunks } from "./source-index-selection.js";
type Point = SourceSceneChunk["coverage"][number];

/** One forward evidence walk serves every adjacent coverage range; no candidate scans from zero. */
export class SourceIndexStillness {
  private before: Point | undefined;
  private next: IteratorResult<Point> | undefined;
  constructor(private readonly points: AsyncGenerator<Point>) {}
  async equality(frame: Pick<SourceFrameArtifact, "sample"> | undefined, range: TimeRange) {
    this.next ??= await this.points.next();
    while (!this.next.done && this.next.value.requestedSourceUs <= range.startUs) {
      this.before = this.next.value;
      this.next = await this.points.next();
    }
    let unchanged =
      !!frame &&
      this.before?.status === "available" &&
      compareSceneSampleClocks(frame.sample, this.before.sample) === 0 &&
      range.startUs - this.before.requestedSourceUs <= scenePolicy.stepUs;
    const run = this.before?.status === "available" ? this.before.stillnessRunStartUs : undefined;
    while (!this.next.done && this.next.value.requestedSourceUs <= range.endUs) {
      const point = this.next.value;
      unchanged &&=
        point.status === "available" &&
        point.continuousFromPrevious &&
        point.stillnessRunStartUs === run;
      this.before = point;
      this.next = await this.points.next();
    }
    return unchanged &&
      this.before &&
      range.endUs - this.before.requestedSourceUs <= scenePolicy.stepUs
      ? ("sampled" as const)
      : ("unproven" as const);
  }
  close() {
    return this.points.return(undefined);
  }
}
export async function* sourceIndexPoints(
  records: Pick<SceneEvidenceStore, "sourcePage">,
  identity: SourceIndexIdentity,
  signal: AbortSignal,
) {
  let through = -1;
  for await (const chunk of sourceIndexChunks(records, identity.scenes, signal))
    for (const point of chunk.coverage) {
      if (point.requestedSourceUs <= through) continue;
      signal.throwIfAborted();
      through = point.requestedSourceUs;
      yield point;
    }
}
