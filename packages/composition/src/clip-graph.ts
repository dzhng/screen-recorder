import type { ValidatedComposition } from "./model.js";

/** Shared attachment and synchronization closure for structural edits. */
export function clipGraph(model: ValidatedComposition) {
  const children = new Map<string, string[]>();
  const groups = new Map<string, readonly string[]>();
  for (const value of model.clips) {
    const anchor = value.clip.placement;
    if (anchor.kind !== "project") {
      const siblings = children.get(anchor.clipId) ?? [];
      siblings.push(value.clip.id);
      children.set(anchor.clipId, siblings);
    }
  }
  for (const group of model.document.syncGroups)
    for (const id of group.clipIds) groups.set(id, group.clipIds);
  const expand = (ids: Iterable<string>, linked: boolean) => {
    const result = new Set(ids);
    const expandedGroups = new Set<readonly string[]>();
    const pending = [...result];
    for (let index = 0; index < pending.length; index++) {
      const id = pending[index]!;
      const group = linked ? groups.get(id) : undefined;
      const related = [...(children.get(id) ?? [])];
      if (group && !expandedGroups.has(group)) {
        expandedGroups.add(group);
        for (const member of group) related.push(member);
      }
      for (const child of related)
        if (!result.has(child)) {
          result.add(child);
          pending.push(child);
        }
    }
    return result;
  };
  return { children, expand };
}
