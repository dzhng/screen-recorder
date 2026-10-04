# 01 — Replicate the Sparkle boundary

Unlock: the exact pinned upstream engine can authenticate, admit, defer and replace
an update through supported interfaces. This is a disposable reproduction, not
production integration. Depends on no other slice.

## Seam and artifact

Use Sparkle 2.10.0 from [research identities](../assets/research.json), with a tiny
SwiftPM app, two distinguishable versions and controlled feed/archive responses.
Follow [programmatic setup](https://sparkle-project.org/documentation/programmatic-setup/).
Give lab apps a distinct bundle ID/defaults domain, such as
`dev.screenrec.update-lab`: `SCREENREC_DEFAULTS` isolates our settings but does not
redirect Sparkle's host-bundle preferences. Never launch a lab updater under the
real release ID in the user's account. Record its license and helper architecture.
The app takes one busy/idle fixture input and records candidate, signature status,
veto decision, install-block invocation, termination and relaunch.

Candidate admission receives `{version, catalogFormat, signingValidationStatus}`
from `SUAppcastItem`. Use one unnamespaced custom item element
`screenrecCatalogFormat`; prove it survives `propertiesDictionary`. Require a
verified feed and same format at `shouldProceedWithUpdate`, before download/install.
Use the signed-feed/pre-extraction settings fixed in the feature README. Generate
only disposable keys in isolated state; do not provision release credentials.

Human artifact: one bounded runner producing a real A→B replacement and complete
callback/failure trace, with all app paths and fixture identities visible. Commit
its runnable inputs and evidence receipt; keep generated binaries out of Git.

## Proof

Write failing behavior cases before wiring the reproduction:

- Valid newer same-format candidate; busy download followed by idle install.
- Altered/unsigned feed, wrong/missing archive signature and corrupt download
  preserve the old executable. Feed validation must not expire into fallback.
- Missing/malformed/different format is vetoed. A forged format in altered feed
  cannot override the candidate decision. Equal/older versions are refused.
- Custom extension roundtrips through the actual signed feed/parser/delegate.
- Deferred immediate-install block, automatic installation, user-requested update,
  ordinary quit/logout and canceled termination all respect install eligibility.
- Turning updates off **after staging** prevents automatic install, including on
  later quit, through a supported API. Normal quit must remain usable.
- Framework symlinks, helpers, executable modes and rpath work after ZIP relocation.
  Probe HTTPS redirects separately without treating a local feed as GitHub proof.
- Record relaunch arguments/environment and a supported quiet-intent mechanism
  preserving selected home/defaults; Settings must stay closed even when its
  ordinary-launch preference is on.

Keep green: ordinary launch remains capture-free; change no library or personal defaults. Record
which replacement failures Sparkle restores and which startup failures it does not.
Do not infer postlaunch rollback from successful rename recovery.

## Verdict and freedoms

Freeze source/dependencies/configuration, signed fixture bytes, commands, OS/arch
and full results by commit/digest before porting. No accepted runnable spike exists
yet. If staged opt-out, pre-install veto or quit safety needs private Sparkle APIs,
a fork, paid signing or permanent quit refusal, record the failed probe and reslice
before production work; do not substitute a promise.

Delegated: reproduction names, HTTP fixture implementation and trace layout.
Fixed: engine/version, trust settings, compatibility and no-interruption rules.
Feedback changes this slice only if the actual busy/disabled experience contradicts
the agreed behavior. Review its CLI trace/report; no visual redesign is involved.
