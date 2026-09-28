# Processing discovery — completed map

Completed 2026-09-27. The [implementation contract](processing.md) now resolves
this map’s technical design queue into owning slices; use the [handoff](README.md)
for implementation order. This extends [the original discovery](MAP.md). Decisions
below describe requested behavior, not shipped capabilities. The user chose
simplicity over shared-setting inheritance and per-member overrides.

## Known knowns

- External agents operate the editor; no editing UI is required.
- Processing must be optional, ordered and non-destructive, for audio and video.
- Noise reduction is requested but its backend and audible quality are unverified.
- The current [composition schema](../../packages/composition/src/schema.ts)
  only accepts empty effects arrays. This discovery does not implement processors.

## Known unknowns — decision ledger

All decisions below were closed by the user in this follow-up walk.

| Decision | Reason |
| --- | --- |
| One ordered stack per target: clip, track, group or final output. | One mental model at every scope. |
| Each stack processes its target's result; parent stacks process combined child output. | Avoid a second inheritance/override system. |
| Get a stack; set its complete ordered list atomically. | The same operation adds, removes, configures and reorders steps. Stable step IDs and `enabled: false` allow inspection and bypass. |
| Groups nest; each track/group feeds one parent. | Explicit clip → track → enclosing groups → output flow, without arbitrary parallel routing. |
| Replacement keeps compatible processing by default, with explicit reset. | Preserve editing intent; recompute results and flag source-dependent settings needing attention. |
| A split preserves the sound/look and allows subsequent independent edits. | Structural edits must not introduce processing discontinuities. |
| Whole-duration processing defaults; optional time windows, transitions and supported parameter animation. | Local treatment without artificial cuts. |
| No per-clip exemption from a parent step; no linked member-settings feature. | An exception uses clip processing or a separate track. Agents can copy stacks to several targets in one atomic batch. |

The final simplicity decision supersedes earlier acceptance of inherited member
settings and per-phrase bypass of a shared parent step. New narration receives
track processing because it contributes to that track, not because settings are
copied or inherited onto the clip.

## Unknown knowns — preferences extracted

- The user explicitly values the simplest understandable API over additional
  routing flexibility. One stack vocabulary wins over two types of shared effects.
- Narration and music need separate treatment; generated phrases may need local
  level adjustment. Shared narration changes should affect new narration too.
- Existing context remains: local macOS, agent-driven verification/export,
  colleagues/customers and public viewers, and honest reporting of quality limits.
- The workflow example exposed conflicting expectations about member exceptions;
  the user resolved them in favor of the simple combined-result model.

## Unknown unknowns — findings and open gates

This was a bounded design scan, not a complete implementation audit. Coverage:
composition schema, existing attachment ownership (independent read-only scan),
processing draft, contracts, audio-mixing slice and native PCM mixing implementation.

| Status | Evidence / consequence | Resolution or unblock |
| --- | --- | --- |
| DECIDED | [PCM mixing](../../helpers/mac/Sources/ScreenRecorderAudio/AudioPCMStream.swift) sums contributors into one result. A later processor cannot generally exempt one contributor. | Combined-result stacks only; use clip stacks or separate tracks for exceptions. |
| SHARP EDGE | [Audio mixing plan](slices/08-audio-mixing.md) distinguishes explicit gain from automatic normalization; the legacy PCM implementation uses source-count gain. | New stack execution must not inherit hidden loudness policies. |
| OPEN | Current schema has neither processing targets nor nested processing groups. | Reconcile typed ownership, target identities and native compiler plans before implementation; keep one source of truth. |
| OPEN | Existing draft uses source/project stages, which adds an API concept not selected in the simpler model. | Define fixed placement relative to retiming and coordinate domains; do not silently reintroduce user-facing stage stacks. |
| OPEN | Stateful denoising can change at cuts or leak excluded input into a selection. | Reproduce state/context, exact timing, selection isolation and pure-split preservation before backend adoption. |
| OPEN | Combined video groups require concrete bounds, compositing and transform semantics. | Define and verify order using asymmetric landmarks; preserve the selected nested model. |
| OPEN | Replacement compatibility and source-specific noise profiles need deterministic rules. | Validate settings against replacement media, surface invalid dependencies, and never silently discard or bypass them. |
| OPEN | Time windows, animated settings and group movement need exact anchor semantics. | Reuse existing time/curve ownership and prove trim/split/move behavior. |
| OPEN | Long previews and portable historical results can require expensive preparation. | Verify bounded inspection, explicit preparation, cache invalidation and retained outputs for undo/package playback. |
| OPEN | Noise reduction may damage consonants or introduce pumping/echo. | Compare local candidates on real narration, clean controls and known-noise mixtures; listening plus timing/resource evidence. |

Open entries are technical design/research gates, not unanswered product scope
questions or permission to weaken accepted behavior.

## Copyable next prompt

Continue the reconciled [spec](README.md) through its verification gates. Use one get/set stack API per clip, track, nested group or
output; process combined results at parent scopes. Preserve originals, revisions,
compatible settings on replacement and sound/look across pure splits. Support
bypass, time windows and supported automation. Do not add inherited member settings,
per-member parent overrides or arbitrary routing. Resolve the open technical gates
explicitly and report noise-reduction quality honestly.

The design questions about ownership, fixed retime order, coordinates and rejection
of incompatible replacement are resolved in processing.md. Backend quality,
stateful boundaries, native parity and resource limits remain gated research.
