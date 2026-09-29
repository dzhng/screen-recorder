import { remapClipProcessing } from "./processing.js";
import { clipGraph } from "./clip-graph.js";
import type { ValidatedComposition } from "./model.js";
import { transformClips } from "./transform.js";

export function duplicateClips(
  model: ValidatedComposition,
  selected: readonly string[],
  atUs: number,
  scope: "linked" | "selected",
  tracks: readonly { clipId: string; trackId: string }[],
  allocate: (kind: "clip" | "syncGroup" | "processingStep", copiedFrom?: string) => string,
) {
  const affected = clipGraph(model).expand(selected, scope === "linked");
  const ids = new Map(
    model.document.clips
      .filter((clip) => affected.has(clip.id))
      .map((clip) => [clip.id, allocate("clip")]),
  );
  const copies = transformClips(model, affected, { atUs }, tracks, true)
    .clips.filter((clip) => affected.has(clip.id))
    .map((clip) => {
      const anchor = clip.placement;
      return {
        ...clip,
        id: ids.get(clip.id)!,
        placement:
          anchor.kind !== "project" && ids.has(anchor.clipId)
            ? { ...anchor, clipId: ids.get(anchor.clipId)! }
            : anchor,
      };
    });
  const groups = model.document.syncGroups.flatMap((group) => {
    const clipIds = group.clipIds.filter((id) => ids.has(id)).map((id) => ids.get(id)!);
    return clipIds.length >= 2 ? [{ id: allocate("syncGroup"), clipIds }] : [];
  });
  const clips = [...model.document.clips, ...copies];
  const lineage = [...ids].map(([originalId, id]) => ({ originalId, clipIds: [id] }));
  return {
    document: {
      ...model.document,
      clips,
      processing: remapClipProcessing(model.document, clips, lineage, allocate, new Map(), "copy"),
      syncGroups: [...model.document.syncGroups, ...groups],
    },
    lineage,
  };
}
