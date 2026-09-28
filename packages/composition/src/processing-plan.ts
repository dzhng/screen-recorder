import type { ValidatedComposition } from "./model.js";
import { processingKey } from "./processing.js";
import { compareRoutingSiblings } from "./routing.js";
import type { ProcessingTarget } from "./schema.js";

export type ProcessingInstruction = {
  target: ProcessingTarget;
  mediaKind: "audio" | "video" | "output";
  inputs: ProcessingTarget[];
  steps: ValidatedComposition["document"]["processing"][number]["steps"];
};
type Entry = Omit<ProcessingInstruction, "inputs"> & { parent?: ProcessingTarget; order: number };

/** Compile only requested occurrences and their ancestors, in child-before-parent execution order. */
export function processingPlanner(model: ValidatedComposition) {
  const stacks = new Map(
    model.document.processing.map((stack) => [processingKey(stack.target), stack.steps]),
  );
  const entries = new Map<string, Entry>();
  function add(
    target: ProcessingTarget,
    mediaKind: Entry["mediaKind"],
    order: number,
    parent?: ProcessingTarget,
  ) {
    entries.set(processingKey(target), {
      target: Object.freeze(target),
      mediaKind,
      order,
      steps: stacks.get(processingKey(target)) ?? Object.freeze([]),
      ...(parent ? { parent: Object.freeze(parent) } : {}),
    });
  }
  add({ kind: "output" }, "output", 0);
  for (const kind of ["track", "group"] as const)
    for (const node of kind === "track" ? model.document.tracks : model.document.groups)
      add(
        { kind, id: node.id },
        node.kind,
        node.order,
        node.parentId === undefined ? { kind: "output" } : { kind: "group", id: node.parentId },
      );
  for (const [index, value] of model.clips.entries())
    add({ kind: "clip", id: value.clip.id }, value.track.kind, index, {
      kind: "track",
      id: value.clip.trackId,
    });
  return (clips: readonly ValidatedComposition["clips"][number][]): ProcessingInstruction[] => {
    const selected = new Map<string, Entry>();
    const children = new Map<string, Entry[]>();
    for (const clip of clips) {
      let target: ProcessingTarget | undefined = { kind: "clip", id: clip.clip.id };
      while (target) {
        const key = processingKey(target);
        if (selected.has(key)) break;
        const entry = entries.get(key)!;
        selected.set(key, entry);
        if (entry.parent) {
          const parentKey = processingKey(entry.parent);
          const siblings = children.get(parentKey) ?? [];
          siblings.push(entry);
          children.set(parentKey, siblings);
        }
        target = entry.parent;
      }
    }
    const output = entries.get(processingKey({ kind: "output" }))!;
    for (const siblings of children.values())
      siblings.sort((a, b) => {
        if (a.target.kind === "clip" || b.target.kind === "clip") return a.order - b.order;
        if (a.target.kind === "output" || b.target.kind === "output") return 0;
        return compareRoutingSiblings({ ...a.target, node: a }, { ...b.target, node: b });
      });
    const result: ProcessingInstruction[] = [];
    const pending = [{ entry: output, visited: false }];
    while (pending.length) {
      const { entry, visited } = pending.pop()!;
      const inputs = children.get(processingKey(entry.target)) ?? [];
      if (visited)
        result.push({
          target: entry.target,
          mediaKind: entry.mediaKind,
          inputs: inputs.map((child) => child.target),
          steps: entry.steps,
        });
      else {
        pending.push({ entry, visited: true });
        for (let i = inputs.length - 1; i >= 0; i--)
          pending.push({ entry: inputs[i]!, visited: false });
      }
    }
    return result;
  };
}
