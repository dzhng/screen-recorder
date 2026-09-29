import { z } from "zod";
import { CompositionError } from "./errors.js";
import { compare, fromTime, toTime } from "./rational.js";
import { sampleAt } from "./sample-clock.js";
import {
  compositionSchema,
  processingTargetSchema,
  selectionRangeSchema,
  type ProcessingStep,
  type ProcessingTarget,
} from "./schema.js";
import { processingInstructionSchema, processingPlanner } from "./processing-plan.js";
import { processingKey } from "./processing.js";
import { temporalProcessing } from "./temporal-processing.js";
import type { ValidatedComposition, ExactRange } from "./model.js";

const id = z.string().min(1);
const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sampleRange = z.object({ start: z.int().nonnegative(), end: z.int().nonnegative() }).strict();
export const statePlanSchema = z
  .object({
    inputs: z.array(
      z
        .object({
          clip: compositionSchema.shape.clips.element,
          range: selectionRangeSchema,
          available: z.array(selectionRangeSchema),
          selected: z.array(selectionRangeSchema),
          unavailable: z.array(selectionRangeSchema),
          sampleRate: z.number().finite().positive().optional(),
          channels: z.int().positive().optional(),
        })
        .strict(),
    ),
    nodes: z.array(processingInstructionSchema.extend({ range: selectionRangeSchema }).strict()),
    domains: z.array(
      z
        .object({
          identity: z.object({ kind: z.enum(["instance", "shared"]), id }).strict(),
          range: selectionRangeSchema,
          sampleRange,
          dependencies: z.array(z.int().nonnegative()),
          members: z.array(
            z
              .object({ target: processingTargetSchema, stepId: id, range: selectionRangeSchema })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type StatePlan = z.infer<typeof statePlanSchema>;
type Range = StatePlan["domains"][number]["range"];
export const stateIdentity = (step: ProcessingStep) =>
  step.stateKey === undefined
    ? { kind: "instance" as const, id: step.id }
    : { kind: "shared" as const, id: step.stateKey };
const stored = (range: ExactRange): Range => ({
  startUs: toTime(range.start),
  endUs: toTime(range.end),
});
function intersection(a: Range, b: Range): Range | undefined {
  const startUs = compare(fromTime(a.startUs), fromTime(b.startUs)) > 0 ? a.startUs : b.startUs;
  const endUs = compare(fromTime(a.endUs), fromTime(b.endUs)) < 0 ? a.endUs : b.endUs;
  return compare(fromTime(startUs), fromTime(endUs)) < 0 ? { startUs, endUs } : undefined;
}

function unionRanges(ranges: Range[]): Range[] {
  const result: Range[] = [];
  for (const range of [...ranges].sort((a, b) =>
    compare(fromTime(a.startUs), fromTime(b.startUs)),
  )) {
    const last = result.at(-1);
    if (!last || compare(fromTime(last.endUs), fromTime(range.startUs)) < 0)
      result.push({ ...range });
    else if (compare(fromTime(range.endUs), fromTime(last.endUs)) > 0) last.endUs = range.endUs;
  }
  return result;
}
function missingRanges(selected: Range[], available: Range[]): Range[] {
  const support = unionRanges(available),
    missing: Range[] = [];
  let index = 0;
  for (const range of selected) {
    let start = range.startUs;
    while (index < support.length && compare(fromTime(support[index]!.endUs), fromTime(start)) <= 0)
      index++;
    let next = index;
    while (
      next < support.length &&
      compare(fromTime(support[next]!.startUs), fromTime(range.endUs)) < 0
    ) {
      const part = support[next]!;
      if (compare(fromTime(start), fromTime(part.startUs)) < 0)
        missing.push({ startUs: start, endUs: part.startUs });
      if (compare(fromTime(part.endUs), fromTime(range.endUs)) >= 0) {
        start = range.endUs;
        break;
      }
      start = part.endUs;
      next++;
    }
    index = next;
    if (compare(fromTime(start), fromTime(range.endUs)) < 0)
      missing.push({ startUs: start, endUs: range.endUs });
  }
  return missing;
}

/** Traverse a member's current exclusive prefix, never a downstream caller's expanded prefix. */
function prefixInputs(plan: Pick<StatePlan, "nodes">) {
  const nodes = new Map(plan.nodes.map((node) => [processingKey(node.target), node]));
  return (
    target: ProcessingTarget,
    before: string,
    range: Range,
    visit: (node: StatePlan["nodes"][number], end: number, range: Range) => void,
  ) => {
    const first = nodes.get(processingKey(target))!;
    const pending = [{ node: first, end: first.steps.findIndex((s) => s.id === before), range }];
    while (pending.length) {
      const { node, end, range } = pending.pop()!;
      visit(node, end, range);
      for (let i = node.inputs.length - 1; i >= 0; i--) {
        const child = nodes.get(processingKey(node.inputs[i]!));
        if (!child) continue;
        const selected = intersection(range, child.range);
        if (selected) pending.push({ node: child, end: child.steps.length, range: selected });
      }
    }
  };
}

/** Derive current structural audio and ordered prefixes using the existing routing and clock owners. */
export function deriveStatePlan(model: ValidatedComposition): StatePlan {
  if (
    !model.document.processing.some((stack) =>
      stack.steps.some((step) => step.processor.type === "rnnoise"),
    )
  )
    return { inputs: [], nodes: [], domains: [] };
  const audio = model.clips.filter((clip) => clip.track.kind === "audio");
  const clips = new Map(audio.map((clip) => [clip.clip.id, clip]));
  const nodes: StatePlan["nodes"] = [];
  const ranges = new Map<string, Range>();
  for (const node of processingPlanner(model)(audio, undefined, "audio")) {
    const children = node.inputs.flatMap((child) => {
      const range = ranges.get(processingKey(child));
      return range ? [range] : [];
    });
    let range = node.target.kind === "clip" ? stored(clips.get(node.target.id)!.range) : undefined;
    for (const child of children)
      range = range
        ? {
            startUs:
              compare(fromTime(range.startUs), fromTime(child.startUs)) < 0
                ? range.startUs
                : child.startUs,
            endUs:
              compare(fromTime(range.endUs), fromTime(child.endUs)) > 0 ? range.endUs : child.endUs,
          }
        : child;
    if (range) {
      ranges.set(processingKey(node.target), range);
      nodes.push({ ...node, range });
    }
  }
  const temporal = temporalProcessing(model);
  type Member = { node: StatePlan["nodes"][number]; step: ProcessingStep };
  const groups = new Map<
    string,
    { identity: StatePlan["domains"][number]["identity"]; members: Member[] }
  >();
  for (const node of nodes)
    for (const step of node.steps) {
      if (step.processor.type !== "rnnoise") continue;
      const identity = stateIdentity(step),
        key = JSON.stringify(identity);
      const group = groups.get(key) ?? { identity, members: [] };
      group.members.push({ node, step });
      groups.set(key, group);
    }
  const domains: StatePlan["domains"] = [];
  const invalidMembers = new Set<string>();
  for (const group of groups.values()) {
    group.members.sort(
      (a, b) =>
        compare(fromTime(a.node.range.startUs), fromTime(b.node.range.startUs)) ||
        compareId(a.step.id, b.step.id),
    );
    if (
      group.identity.kind === "shared" &&
      (group.members.some((m) => m.node.target.kind !== "clip") ||
        new Set(
          group.members.map((m) =>
            m.node.target.kind === "clip" ? clips.get(m.node.target.id)!.clip.trackId : "",
          ),
        ).size > 1 ||
        new Set(group.members.map((m) => processingKey(m.node.target))).size !==
          group.members.length)
    ) {
      for (const member of group.members) invalidMembers.add(member.step.id);
      continue;
    }
    let domain: StatePlan["domains"][number] | undefined;
    for (const { node, step } of group.members) {
      const active = temporal.active(step, node.target).flatMap((part) => {
        const range = intersection(stored(part), node.range);
        return range ? [range] : [];
      });
      if (!active.length) domain = undefined;
      for (const range of active) {
        if (!domain || compare(fromTime(domain.range.endUs), fromTime(range.startUs)) !== 0) {
          domain = {
            identity: group.identity,
            range,
            sampleRange: {
              start: sampleAt(fromTime(range.startUs), 48000),
              end: sampleAt(fromTime(range.endUs), 48000),
            },
            members: [],
            dependencies: [],
          };
          domains.push(domain);
        } else {
          domain.range = { ...domain.range, endUs: range.endUs };
          domain.sampleRange.end = sampleAt(fromTime(range.endUs), 48000);
        }
        domain.members.push({ target: node.target, stepId: step.id, range });
      }
    }
  }
  if (invalidMembers.size)
    throw new CompositionError(
      "INVALID_COMPOSITION",
      "Shared state requires distinct clips on one track",
      { stateStepIds: [...invalidMembers] },
    );
  domains.sort(
    (a, b) =>
      compare(fromTime(a.range.startUs), fromTime(b.range.startUs)) ||
      compareId(JSON.stringify(a.identity), JSON.stringify(b.identity)),
  );
  const plan: StatePlan = {
    nodes,
    domains,
    inputs: audio.map((clip) => ({
      clip: clip.clip,
      range: stored(clip.range),
      available: clip.available.map(stored),
      selected: [],
      unavailable: [],
      ...(clip.stream?.kind === "audio" && clip.stream.channels !== undefined
        ? { channels: clip.stream.channels }
        : {}),
      ...(clip.stream?.kind === "audio" && clip.stream.sampleRate !== undefined
        ? { sampleRate: clip.stream.sampleRate }
        : {}),
    })),
  };
  const byStep = new Map<string, { index: number; range: Range }[]>();
  domains.forEach((domain, index) =>
    domain.members.forEach((member) => {
      const entries = byStep.get(member.stepId) ?? [];
      entries.push({ index, range: member.range });
      byStep.set(member.stepId, entries);
    }),
  );
  const visitPrefix = prefixInputs(plan);
  for (const domain of domains) {
    const dependencies = new Set<number>();
    for (const member of domain.members)
      visitPrefix(member.target, member.stepId, member.range, (node, end, range) => {
        for (const step of node.steps.slice(0, end))
          if (step.enabled)
            for (const prior of byStep.get(step.id) ?? [])
              if (intersection(prior.range, range)) dependencies.add(prior.index);
      });
    domain.dependencies = [...dependencies].sort((a, b) => a - b);
  }
  const status = new Uint8Array(domains.length);
  const cycleMembers = new Set<string>();
  for (let start = 0; start < domains.length; start++) {
    if (status[start]) continue;
    const stack = [{ index: start, next: 0 }];
    status[start] = 1;
    while (stack.length) {
      const frame = stack.at(-1)!;
      const dependency = domains[frame.index]!.dependencies[frame.next++];
      if (dependency === undefined) {
        status[frame.index] = 2;
        stack.pop();
        continue;
      }
      if (status[dependency] === 1) {
        for (const frame of stack.slice(stack.findIndex((f) => f.index === dependency)))
          for (const member of domains[frame.index]!.members) cycleMembers.add(member.stepId);
      } else if (!status[dependency]) {
        status[dependency] = 1;
        stack.push({ index: dependency, next: 0 });
      }
    }
  }
  if (cycleMembers.size)
    throw new CompositionError("INVALID_COMPOSITION", "State domain dependency cycle", {
      stateStepIds: [...cycleMembers],
    });
  return plan;
}

export function selectStatePlan(
  plan: StatePlan,
  stepIds: ReadonlySet<string>,
  range: Range,
): StatePlan {
  const selected = new Set<number>();
  const pending = plan.domains.flatMap((d, i) =>
    d.members.some((m) => stepIds.has(m.stepId) && intersection(m.range, range)) ? [i] : [],
  );
  while (pending.length) {
    const index = pending.pop()!;
    if (selected.has(index)) continue;
    selected.add(index);
    pending.push(...plan.domains[index]!.dependencies);
  }
  const indices = [...selected].sort((a, b) => a - b),
    remap = new Map(indices.map((old, i) => [old, i]));
  const domains = indices.map((i) => ({
    ...plan.domains[i]!,
    dependencies: plan.domains[i]!.dependencies.map((d) => remap.get(d)!),
  }));
  const needed = new Map<string, { end: number; children: Set<string>; ranges: Range[] }>();
  const byTarget = new Map(plan.nodes.map((node) => [processingKey(node.target), node]));
  const visitPrefix = prefixInputs(plan);
  for (const domain of domains)
    for (const member of domain.members) {
      visitPrefix(member.target, member.stepId, member.range, (node, end, range) => {
        const key = processingKey(node.target);
        const prior = needed.get(key) ?? { end: 0, children: new Set<string>(), ranges: [] };
        // Include the member itself as recipe identity; its input still ends immediately before it.
        prior.end = Math.max(prior.end, end + (key === processingKey(member.target) ? 1 : 0));
        for (const child of node.inputs) {
          const childNode = byTarget.get(processingKey(child));
          if (childNode && intersection(range, childNode.range))
            prior.children.add(processingKey(child));
        }
        prior.ranges.push(range);
        needed.set(key, prior);
      });
    }
  const nodes = plan.nodes.flatMap((node) => {
    const need = needed.get(processingKey(node.target));
    return need
      ? [
          {
            ...node,
            steps: node.steps.slice(0, need.end),
            inputs: node.inputs.filter((child) => need.children.has(processingKey(child))),
          },
        ]
      : [];
  });
  return {
    domains,
    nodes,
    inputs: plan.inputs.flatMap((input) => {
      const need = needed.get(processingKey({ kind: "clip", id: input.clip.id }));
      if (!need) return [];
      const selected = unionRanges(need.ranges);
      return [{ ...input, selected, unavailable: missingRanges(selected, input.available) }];
    }),
  };
}

/** Repair only changed occurrences at an edit boundary; imported documents never take this path. */
export function normalizeStateEdit(before: ValidatedComposition, candidate: ValidatedComposition) {
  try {
    deriveStatePlan(candidate);
    return candidate.document;
  } catch (error) {
    if (!(error instanceof CompositionError) || !Array.isArray(error.details.stateStepIds))
      throw error;
    const prior = new Map(before.clips.map((c) => [c.clip.id, c]));
    const stacks = new Map(
      before.document.processing
        .filter((s) => s.target.kind === "clip")
        .map((s) => [s.target.kind === "clip" ? s.target.id : "", s.steps]),
    );
    const candidateStacks = new Map(
      candidate.document.processing
        .filter((s) => s.target.kind === "clip")
        .map((s) => [s.target.kind === "clip" ? s.target.id : "", s.steps]),
    );
    const changed = new Set(
      candidate.clips
        .filter((c) => {
          const old = prior.get(c.clip.id);
          return (
            !old ||
            JSON.stringify(c.clip) !== JSON.stringify(old.clip) ||
            compare(c.range.start, old.range.start) !== 0 ||
            compare(c.range.end, old.range.end) !== 0 ||
            JSON.stringify(stacks.get(c.clip.id) ?? []) !==
              JSON.stringify(candidateStacks.get(c.clip.id) ?? [])
          );
        })
        .map((c) => c.clip.id),
    );
    let document = candidate.document;
    let remaining = document.processing.reduce(
      (count, stack) => count + stack.steps.filter((step) => step.stateKey !== undefined).length,
      0,
    );
    let conflict: unknown = error;
    // Every repeat removes shared membership; a newly exposed violation cannot cause unchanged retries.
    while (remaining > 0) {
      if (!(conflict instanceof CompositionError) || !Array.isArray(conflict.details.stateStepIds))
        throw conflict;
      const implicated = new Set(conflict.details.stateStepIds as string[]);
      let removed = 0;
      const processing = document.processing.map((stack) => {
        if (
          stack.target.kind !== "clip" ||
          !changed.has(stack.target.id) ||
          !stack.steps.some((step) => implicated.has(step.id))
        )
          return stack;
        return {
          ...stack,
          steps: stack.steps.map((step) => {
            if (step.stateKey === undefined) return step;
            const next = { ...step };
            delete next.stateKey;
            removed++;
            return next;
          }),
        };
      });
      if (removed === 0) throw conflict;
      remaining -= removed;
      document = { ...document, processing };
      try {
        deriveStatePlan({ ...candidate, document });
        return document;
      } catch (next) {
        conflict = next;
      }
    }
    throw conflict;
  }
}
