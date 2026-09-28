import { CompositionError } from "./errors.js";
import type { Composition } from "./schema.js";
type Node = Readonly<Composition["tracks"][number]>;
export type RoutingTarget = Readonly<{ kind: "track" | "group"; id: string }>;
type Entry = RoutingTarget & { node: Node };
function invalid(message: string): never {
  throw new CompositionError("INVALID_COMPOSITION", message);
}

/** Validate the parent forest once and derive the order shared by evidence and rendering. */
export function resolveRouting(document: {
  readonly tracks: readonly Node[];
  readonly groups: readonly Node[];
}): string[] {
  const groups = new Map<string, Node>();
  for (const group of document.groups) {
    if (groups.has(group.id)) invalid(`Duplicate processing group ID: ${group.id}`);
    groups.set(group.id, group);
  }
  const children = new Map<string | undefined, Entry[]>();
  const add = (node: Node, kind: Entry["kind"]) => {
    if (node.parentId !== undefined) {
      const parent = groups.get(node.parentId);
      if (!parent) invalid(`Unknown processing parent: ${node.parentId}`);
      if (parent.kind !== node.kind) invalid(`Processing parent media kind mismatch: ${node.id}`);
    }
    const siblings = children.get(node.parentId) ?? [];
    siblings.push({ kind, id: node.id, node });
    children.set(node.parentId, siblings);
  };
  for (const node of document.groups) add(node, "group");
  for (const node of document.tracks) add(node, "track");
  for (const siblings of children.values()) {
    const visualOrders = new Set<number>();
    for (const { node } of siblings)
      if (node.kind === "video") {
        if (visualOrders.has(node.order)) invalid(`Duplicate video layer order: ${node.order}`);
        visualOrders.add(node.order);
      }
    siblings.sort(
      (a, b) =>
        a.node.order - b.node.order ||
        (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }
  const pending = [...(children.get(undefined) ?? [])].reverse();
  const tracks: string[] = [];
  let visitedGroups = 0;
  while (pending.length) {
    const entry = pending.pop()!;
    if (entry.kind === "track") tracks.push(entry.id);
    else {
      visitedGroups++;
      const nested = children.get(entry.id) ?? [];
      for (let i = nested.length - 1; i >= 0; i--) pending.push(nested[i]!);
    }
  }
  // Every node has one parent, so any group unreachable from output belongs to a cycle.
  if (visitedGroups !== groups.size) invalid("Processing parent cycle");
  return tracks;
}
