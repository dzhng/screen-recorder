import { validateComposition, type ValidatedComposition } from "./model.js";
import { subtract } from "./rational.js";
import { rippleTimeline } from "./ripple.js";
import { transformSelection } from "./transform.js";

export function retimeClips(
  model: ValidatedComposition,
  selected: readonly string[],
  timing: { durationUs: number; pitch: "preserve" | "follow" },
  scope: "linked" | "selected",
  tracks: readonly string[] | "none",
  allocate: (kind: "syncGroup") => string,
) {
  const transformed = transformSelection(model, selected, timing, scope, allocate, []);
  if (tracks === "none") return { document: transformed.document, touchedFixedAnchors: [] };
  const result = rippleTimeline(
    validateComposition(
      { ...model.document, syncGroups: transformed.document.syncGroups },
      model.assets,
    ),
    {
      kind: "resize",
      at: transformed.before.end,
      delta: subtract(transformed.after.end, transformed.before.end),
      targets: transformed.affected,
    },
    tracks,
  );
  const changed = new Map(
    transformed.document.clips
      .filter((clip) => transformed.affected.has(clip.id))
      .map((clip) => [clip.id, clip]),
  );
  return {
    ...result,
    document: {
      ...result.document,
      clips: result.document.clips.map((clip) => changed.get(clip.id) ?? clip),
    },
  };
}
