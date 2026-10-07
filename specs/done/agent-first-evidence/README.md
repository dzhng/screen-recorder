# Agent-first media evidence

Yap now exposes three evidence contracts for agent-driven media workflows:
source-bound face trajectories, explicit temporal correspondence receipts, and
quality-gated long-form speaker continuity. They exist because agents need the
measurements and uncertainty that precede a crop, synchronization choice, or
speaker label, while Yap's product boundary forbids making those editorial
decisions itself.

The contracts preserve one rule: a measured fact remains distinguishable from a
prediction, a candidate remains distinguishable from an accepted mapping, a
transport result remains distinguishable from a quality pass, and an anonymous
slot remains distinguishable from a human name. Original media remains
untouched.

## Why this shape

The existing face detector and speaker provider already own native observations.
The new evidence reads wrap those owners rather than replacing them. A face
trajectory keeps Vision's exact rectangle and detector domain beside tracker
association, so a caller can choose its own crop policy without mistaking a
tracker hypothesis for a detection. Prediction is opt-in and currently returns
an explicit refusal receipt; no smoothing is implicit.

Temporal correspondence is a general source-bound receipt rather than a hidden
synchronization feature. It accepts complete measured anchors and competing
candidates, fingerprints the endpoint identities, and exposes residuals,
coverage and drift. A caller may later author an angle or retime a project, but
Yap never promotes an accepted local mapping into an edit or global clock.

Speaker continuity is a quality envelope around the bounded speaker provider.
The frozen DER, identity-confusion, overlap, speaker-count, runtime and memory
gates remain visible in the receipt. A failed long-form candidate stays
readable with its metrics. No slot stitching or automatic naming is allowed,
and `speaker.bind` remains the only caller-authored naming path.

Two production owners are intentionally still absent. Correspondence receipts
are admitted from caller-measured candidates and live for the service lifetime;
continuity receipts use the same service-local lifetime until a provider passes
the retained long-form controls. The service returns `NOT_READY` for package
reads of these local receipts instead of pretending they are durable resources.
This keeps the public contract honest and leaves a clear seam for a future
native estimator or promoted provider to write the same receipts into the
existing package owners.

## Invariants

- Detector rectangles, tracker association, and prediction refusal remain
  separate fields. A missing or ambiguous sample never becomes a synthetic
  observed box.
- Every correspondence endpoint and continuation is pinned to its source or
  prepared project tap. Refused evidence carries no usable mapping and never
  calls an angle or edit operation.
- Continuity metrics describe one complete invocation. Missing score support,
  altered duration, changed provider identity, failed controls, and quality
  failures remain explicit refusal evidence.
- Anonymous speaker slots are generation-local. Labels do not change acoustic
  evidence or erase continuity refusal.
- CLI and MCP discover the same operation schemas because both derive from the
  shared protocol. Existing durable reads keep their package and generation
  rules; these new service-local receipts advertise their limitation.

## Code pointers

- Face association and trajectory formatting live in
  `packages/core/src/face-tracking.ts` and
  `packages/core/src/face-trajectory.ts`. The public read is
  `face.trajectory.get` in `packages/protocol/src/operations.ts` and the shared
  service handler is in `apps/service/src/project-service.ts`.
- Correspondence endpoint, candidate and receipt validation lives in
  `packages/protocol/src/correspondence.ts`; admission and fingerprint replay
  live in `packages/core/src/correspondence.ts`. The public operations are
  `correspondence.prepare` and `correspondence.get`.
- Continuity thresholds, identity pins and gate evaluation live in
  `packages/core/src/speaker-continuity.ts`. The public operations
  `speaker.continuity.prepare` and `speaker.continuity.get` are handled by the
  shared service owner, while existing speaker observation and labeling remain
  in the speaker modules.
- Focused protocol, core, service, and CLI parity tests next to those modules
  pin strict input validation, receipt replay, cursor behavior and refusal
  semantics.

## Rejected approaches

- Smoothing or predicting face boxes by default was rejected because it would
  turn evidence into an unrequested framing decision and hide detector gaps.
- A second synchronization runtime was rejected because the repository has no
  established unlike-microphone estimator owner; callers can supply measured
  candidates without creating competing clock arithmetic.
- Stitching thirty-second anonymous speaker slots by slot number was rejected
  because it would claim person identity without a long-form provider and its
  quality gates.
