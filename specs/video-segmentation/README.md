# Generalized video segmentation processor

Status: future-work placeholder, 2026-09-28. Explicitly outside the current
[agent-editing run](../done/agent-editing/README.md). The user requested a generalized
video processor using something like Meta's SAM 3; person cutouts are one use case,
not a separate person-only feature. No model or runtime has been selected.

## Next Agent Prompt

Do not implement this as part of the active editor build. When the user activates
this work, inspect the then-shipped ordered processing, preparation jobs, visual
compiler and portable dependency owners. Research candidate models on the target
Mac, reproduce the selected approach, and turn this placeholder into a sliced
implementation spec before building. Resolve the open decisions below and update
this handoff. Keep the existing CLI/MCP workflow; an editing UI is not required.

## Outcome

An agent can select a person, object or region in a video and obtain a temporally
consistent mask that participates in the existing processing stack. That mask can
isolate a subject, reveal layers behind it, or constrain supported processing to
the selected area. For example, a graphic can appear behind a presenter's head
while their hair and shoulders remain in front.

The [reference-style audit](../done/agent-editing/assets/reference-style/README.md)
records this effect around 19 and 60–67 seconds in the user's example. The observed
composite establishes the desired result, not the creator's model or technique.

## Architectural boundaries

- Extend the existing generalized video-processing contract and ordered stacks.
  Do not introduce a parallel editing engine or a special presenter mode.
- Keep mask generation distinct from layer placement and creative decisions.
  Segmentation selects pixels; it does not synthesize missing background content.
- Reuse model preparation/readiness, cancellation, immutable source identity,
  revision history and portable dependency ownership. Preserve originals and
  audio. Model-dependent artifacts must have explicit provenance and lifetime.
- Define mask coordinates and timing against the existing composition clock,
  including geometry before/after the processor, trimming, splits and retiming.
  Preview, frame inspection and export must consume the same prepared result.

## Candidate and open questions

[Meta's official SAM 3 repository](https://github.com/facebookresearch/sam3)
describes promptable image/video segmentation and tracking with text and visual
prompts. It is a candidate, not a dependency commitment. As inspected on
2026-09-28, its documented setup requires CUDA; local Apple Silicon execution,
model availability, license terms and resource use need a real feasibility probe.

Before implementation, decide:

- Supported agent inputs: text, points, boxes, exemplar masks, corrections and
  selection of one instance versus several matching objects.
- Mask representation, inversion/composition and how other processors consume it;
  keep the public API as simple as the current ordered processing model.
- Whether segmentation edges are sufficient or a separate matting/refinement
  stage is needed for soft hair edges, transparency and motion blur.
- State across ranges, occlusion, scene changes and reappearance; bounded memory,
  preparation time, cache identity and resumability on realistic clips.
- Model/runtime selection and capability reporting on the supported Mac; no
  cloud fallback or silent substitution is implied.
- Portable masks/prepared outputs, regeneration without the original model cache,
  manual correction scope and any compatibility/migration requirements.

## Proposed acceptance evidence

Use real video through public CLI/MCP operations. Include a presenter with hair
and moving hands, a non-person object, multiple similar objects, occlusion and a
scene change. Inspect full-motion results and edge crops against independently
marked frames; measure flicker, missing subject pixels and background leakage.
Static screenshots alone cannot establish temporal stability.

Verify ordered processing and bypass, foreground/background composition, undo,
historical reads, split/trim/retiming, range/full preview/export correspondence,
relocation, cancellation and resource bounds. Compare candidates with
[compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md) and obtain
an unprimed [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md)
before accepting visual output. Set measured quality/performance gates when
expanding this placeholder; no capability is claimed implemented here.
