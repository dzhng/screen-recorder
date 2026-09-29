import { z } from "zod";
import { CompositionError } from "./errors.js";
import { compare, fromTime, toTime } from "./rational.js";
import { sampleAt } from "./sample-clock.js";
import { compositionSchema, processingStepSchema, selectionRangeSchema } from "./schema.js";
import type { ProcessingStep } from "./schema.js";
import type { ValidatedComposition } from "./model.js";

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
          steps: z.array(processingStepSchema),
        })
        .strict(),
    ),
    domains: z.array(
      z
        .object({
          identity: z.object({ kind: z.enum(["instance", "shared"]), id }).strict(),
          range: selectionRangeSchema,
          sampleRange,
          dependencies: z.array(z.int().nonnegative()),
          members: z.array(z.object({ clipId: id, stepId: id }).strict()),
        })
        .strict(),
    ),
  })
  .strict();
export type StatePlan = z.infer<typeof statePlanSchema>;
export const stateIdentity = (step: ProcessingStep) =>
  step.stateKey === undefined
    ? { kind: "instance" as const, id: step.id }
    : { kind: "shared" as const, id: step.stateKey };
const stored = (range: ValidatedComposition["clips"][number]["range"]) => ({
  startUs: toTime(range.start),
  endUs: toTime(range.end),
});

/** Full current inputs are stored once; a member's step ID selects its actual ordered prefix. */
export function deriveStatePlan(model: ValidatedComposition): StatePlan {
  type Member = { clip: ValidatedComposition["clips"][number]; step: ProcessingStep };
  const groups = new Map<
    string,
    { identity: StatePlan["domains"][number]["identity"]; members: Member[] }
  >();
  const clips = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
  const inputs: StatePlan["inputs"] = [];
  const prior = new Map<string, string>();
  for (const stack of model.document.processing) {
    if (stack.target.kind !== "clip" || !stack.steps.some((s) => s.processor.type === "rnnoise"))
      continue;
    const clip = clips.get(stack.target.id)!;
    inputs.push({
      clip: clip.clip,
      range: stored(clip.range),
      available: clip.available.map(stored),
      steps: [...stack.steps],
    });
    let previous: string | undefined;
    for (const step of stack.steps) {
      if (step.processor.type !== "rnnoise") continue;
      const identity = stateIdentity(step),
        key = JSON.stringify(identity);
      const group = groups.get(key) ?? { identity, members: [] };
      group.members.push({ clip, step });
      groups.set(key, group);
      if (step.enabled) {
        if (previous !== undefined) prior.set(step.id, previous);
        previous = step.id;
      }
    }
  }
  const domains: StatePlan["domains"] = [];
  const invalidMembers = new Set<string>();
  for (const group of groups.values()) {
    group.members.sort(
      (a, b) => compare(a.clip.range.start, b.clip.range.start) || compareId(a.step.id, b.step.id),
    );
    if (
      new Set(group.members.map((m) => m.clip.clip.trackId)).size > 1 ||
      new Set(group.members.map((m) => m.clip.clip.id)).size !== group.members.length
    ) {
      for (const member of group.members) invalidMembers.add(member.step.id);
      continue;
    }
    let domain: StatePlan["domains"][number] | undefined;
    for (const member of group.members) {
      if (!member.step.enabled) {
        domain = undefined;
        continue;
      }
      const range = stored(member.clip.range);
      if (!domain || compare(fromTime(domain.range.endUs), member.clip.range.start) !== 0) {
        domain = {
          identity: group.identity,
          range,
          sampleRange: {
            start: sampleAt(member.clip.range.start, 48000),
            end: sampleAt(member.clip.range.end, 48000),
          },
          members: [],
          dependencies: [],
        };
        domains.push(domain);
      } else {
        domain.range = { ...domain.range, endUs: range.endUs };
        domain.sampleRange.end = sampleAt(member.clip.range.end, 48000);
      }
      domain.members.push({ clipId: member.clip.clip.id, stepId: member.step.id });
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
  const owners = new Map(domains.flatMap((d, i) => d.members.map((m) => [m.stepId, i] as const)));
  for (const domain of domains)
    domain.dependencies = [
      ...new Set(
        domain.members.flatMap((m) =>
          prior.has(m.stepId) ? [owners.get(prior.get(m.stepId)!)!] : [],
        ),
      ),
    ].sort((a, b) => a - b);
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
        const cycle = stack.slice(stack.findIndex((f) => f.index === dependency));
        for (const frame of cycle)
          for (const member of domains[frame.index]!.members) cycleMembers.add(member.stepId);
        continue;
      }
      if (!status[dependency]) {
        status[dependency] = 1;
        stack.push({ index: dependency, next: 0 });
      }
    }
  }
  if (cycleMembers.size)
    throw new CompositionError("INVALID_COMPOSITION", "State domain dependency cycle", {
      stateStepIds: [...cycleMembers],
    });
  return { inputs, domains };
}

export function selectStatePlan(plan: StatePlan, stepIds: ReadonlySet<string>): StatePlan {
  const selected = new Set<number>();
  const pending = plan.domains.flatMap((d, i) =>
    d.members.some((m) => stepIds.has(m.stepId)) ? [i] : [],
  );
  while (pending.length) {
    const index = pending.pop()!;
    if (selected.has(index)) continue;
    selected.add(index);
    for (const input of plan.domains[index]!.dependencies) pending.push(input);
  }
  const indices = [...selected].sort((a, b) => a - b),
    remap = new Map(indices.map((old, i) => [old, i]));
  const domains = indices.map((i) => ({
    ...plan.domains[i]!,
    dependencies: plan.domains[i]!.dependencies.map((d) => remap.get(d)!),
  }));
  const members = new Map<string, Set<string>>();
  for (const domain of domains)
    for (const member of domain.members) {
      const steps = members.get(member.clipId) ?? new Set<string>();
      steps.add(member.stepId);
      members.set(member.clipId, steps);
    }
  return {
    domains,
    inputs: plan.inputs.flatMap((input) => {
      const required = members.get(input.clip.id);
      if (!required) return [];
      let end = 0;
      input.steps.forEach((step, index) => {
        if (required.has(step.id)) end = index + 1;
      });
      return [{ ...input, steps: input.steps.slice(0, end) }];
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
