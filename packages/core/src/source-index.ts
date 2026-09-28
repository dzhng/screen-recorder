import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";
import { selectSource, type SourceSelection } from "./source-selection.js";
import {
  sourceSceneDescriptor,
  type SceneEvidenceMetadata,
  type SceneEvidenceStore,
} from "./scene-evidence.js";
import type {
  SourceFrameArtifact,
  SourceFrameUnavailable,
  MediaFrameInspection,
} from "./frame-inspection.js";
import type { IndexDomain } from "./screenshot-index.js";
import type { SourceIndexReason } from "./source-index-selection.js";
import type { TimeRange } from "./timeline.js";
import { validateSceneSampleClock, type SourceVisualPoint } from "./source-scenes.js";
export type SourceIndexIdentity = SourceSelection & {
  generation: string;
  scenes: SceneEvidenceMetadata;
  selectionPolicy: string;
  implementationId: string;
  maxLongEdge: number;
};
export type SourceIndexCandidate = {
  ordinal: number;
  requestedSourceUs: number;
  support: TimeRange;
  reasons: SourceIndexReason[];
};
export type SourceIndexCoverage = { source: TimeRange } & (
  | { ordinal: number; state: "available"; equality: "sampled" | "unproven" }
  | { ordinal: null; state: "unavailable"; basis: "support" }
  | {
      ordinal: null;
      state: "unavailable";
      basis: "observation";
      equality: "unproven";
      observation:
        | { kind: "scene"; point: Extract<SourceVisualPoint, { status: "unavailable" }> }
        | { kind: "frame"; frame: SourceFrameUnavailable };
    }
);
export type SourceIndexRecords = {
  identity: SourceIndexIdentity;
  candidate: SourceIndexCandidate;
  frame: Omit<SourceFrameArtifact, "cacheId">;
  coverage: SourceIndexCoverage;
};
const invalid = (message: string): never => {
  throw new CatalogError("INVALID_EVIDENCE", message);
};
/** Raw source index receipts use real asset/stream identity and never pretend to be a recording revision. */
export function sourceIndexDomain(
  assets: AssetStore,
  acquisitions: AcquisitionStore,
  scenes: SceneEvidenceStore,
  frames: Pick<MediaFrameInspection, "sourceUnavailable">,
): IndexDomain<SourceIndexRecords> {
  function selected(identity: SourceIndexIdentity) {
    return selectSource(assets, acquisitions, {
      assetId: identity.assetId,
      streamId: identity.streamId,
      ...(identity.acquisitionId === undefined ? {} : { acquisitionId: identity.acquisitionId }),
    });
  }
  return {
    owner: (i) => ({ kind: "asset", assetId: i.assetId }),
    pin: (i) => ({
      assetId: i.assetId,
      streamId: i.streamId,
      ...(i.acquisitionId === undefined ? {} : { acquisitionId: i.acquisitionId }),
      generation: i.generation,
      scenes: i.scenes,
      selectionPolicy: i.selectionPolicy,
      implementationId: i.implementationId,
      maxLongEdge: i.maxLongEdge,
    }),
    begin(identity) {
      const source = selected(identity);
      const metadata = scenes.sourcePage({ identity: identity.scenes, limit: 1 }).metadata;
      if (
        source.stream.kind !== "video" ||
        metadata.owner.kind !== "asset" ||
        metadata.owner.assetId !== identity.assetId ||
        !isDeepStrictEqual(metadata, identity.scenes) ||
        !isDeepStrictEqual(metadata.source, sourceSceneDescriptor(source)) ||
        !identity.generation ||
        !identity.selectionPolicy ||
        !identity.implementationId ||
        !Number.isInteger(identity.maxLongEdge) ||
        identity.maxLongEdge < 1 ||
        identity.maxLongEdge > 8192
      )
        invalid("Source index identity does not match published scenes");
      return source.durationUs;
    },
    candidate(identity, candidate, frame, path) {
      const source = selected(identity);
      if (
        !Number.isSafeInteger(candidate.requestedSourceUs) ||
        !source.track.available.some(
          (r) => r.startUs === candidate.support.startUs && r.endUs === candidate.support.endUs,
        ) ||
        candidate.requestedSourceUs < candidate.support.startUs ||
        candidate.requestedSourceUs >= candidate.support.endUs ||
        frame.file !== path ||
        frame.assetId !== identity.assetId ||
        frame.streamId !== identity.streamId ||
        frame.acquisitionId !== identity.acquisitionId ||
        frame.supportDigest !== source.supportDigest ||
        frame.implementationId !== identity.implementationId ||
        frame.sample.originUs !== -source.track.sourceOffsetUs ||
        frame.maxLongEdge !== identity.maxLongEdge ||
        frame.atUs !== candidate.requestedSourceUs ||
        frame.requestedSourceUs !== candidate.requestedSourceUs
      )
        invalid("Selected source image receipt does not match its candidate");
      validateSceneSampleClock(
        frame.sample,
        candidate.requestedSourceUs,
        frame.actualSourceUs,
        -source.track.sourceOffsetUs,
      );
    },
    coverage(identity, candidate, coverage) {
      if (coverage.state === "available") {
        if (
          !candidate ||
          coverage.source.startUs < candidate.support.startUs ||
          coverage.source.endUs > candidate.support.endUs
        )
          invalid("Available source coverage requires its supported candidate");
      } else {
        if (candidate) invalid("Unavailable index coverage cannot name an image");
        if (coverage.basis === "support") {
          if (
            selected(identity).track.available.some(
              (r) => r.startUs < coverage.source.endUs && r.endUs > coverage.source.startUs,
            )
          )
            invalid("Support exclusion overlaps available footage");
        } else {
          const observation = coverage.observation;
          const at =
            observation.kind === "scene"
              ? observation.point.requestedSourceUs
              : observation.frame.atUs;
          if (
            !Number.isSafeInteger(at) ||
            at < coverage.source.startUs ||
            at >= coverage.source.endUs
          )
            invalid("Unavailable observation lies outside its index coverage");
          if (observation.kind === "scene") {
            const page = scenes.sourceWindowPage({
              identity: identity.scenes,
              range: { startUs: at, endUs: at + 1 },
              limit: 1,
            });
            if (
              !page.chunks[0]!.coverage.some((point) => isDeepStrictEqual(point, observation.point))
            )
              invalid("Unavailable observation is not in the pinned scene evidence");
          } else {
            const frame = observation.frame;
            if (
              !isDeepStrictEqual(frame.selection, selected(identity).selection) ||
              frame.implementationId !== identity.implementationId ||
              frame.maxLongEdge !== identity.maxLongEdge ||
              !isDeepStrictEqual(
                frame,
                frames.sourceUnavailable({
                  ...frame.selection,
                  atUs: frame.atUs,
                  maxLongEdge: frame.maxLongEdge,
                }),
              )
            )
              invalid("Unavailable picture observation does not match the selected source request");
          }
        }
      }
      return coverage.source;
    },
    merge(a, b) {
      if (
        a.ordinal !== b.ordinal ||
        a.state !== b.state ||
        a.source.endUs !== b.source.startUs ||
        (a.state === "available" && b.state === "available" && a.equality !== b.equality) ||
        (a.state === "unavailable" &&
          b.state === "unavailable" &&
          (a.basis !== b.basis ||
            (a.basis === "observation" &&
              b.basis === "observation" &&
              !isDeepStrictEqual(a.observation, b.observation))))
      )
        return null;
      return { ...a, source: { startUs: a.source.startUs, endUs: b.source.endUs } };
    },
    finish(identity) {
      selected(identity);
    },
    isDeleting: () => false,
  };
}
