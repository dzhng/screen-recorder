# 01 — Replicate the Sparkle boundary

Unlock: the exact pinned upstream engine can authenticate, admit, defer and replace
an update through supported interfaces. This is a disposable reproduction, not
production integration. Depends on no other slice.

## Seam and artifact

Use Sparkle 2.10.0 from [research identities](../assets/research.json), with a tiny
native app, two distinguishable versions and controlled feed/archive responses.
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

## Proof status

**Protected engine boundary accepted; production parity remains separate.**
The [accepted receipt](../assets/protected-engine-proof.json) binds the pinned
[source patch](../../../scripts/sparkle), framework fingerprint, controlled source
hashes, signed archives/feed and complete external reports. The final run covers
22 distinct cases once: ten protection/fixture cases and twelve authentication,
compatibility and opt-out cases. Private fixture keys are deleted; public inputs
remain at their receipt paths outside Git. The receipt records the base revision
at execution plus hashes of the working-tree sources committed with this evidence.

The [native guard suite](../../../scripts/update-guard.test.mjs) requires an explicit
built framework; it never silently substitutes upstream. The original
[lab suite](../../../scripts/update-lab.test.mjs) retains upstream's expected-defect
reproduction. A green upstream reproduction does not approve that engine. Its
candidate/authentication cases can also replay against the corrected framework.

The accepted route uses a custom `SPUUserDriver` and Sparkle scheduled checks,
with automatic-install driver selection disabled. The found callback requests
download; the ready reply is retained until the cycle ends, including after Install,
so opt-out can still send Skip. Installing acknowledges a transferred, actually
locked descriptor. It permits clean service EOF but not host exit. Only after
proven child exit does the app invoke the retained final-authorization closure;
the final acknowledgement permits host termination. The helper never issues a
quit event. Successful cancellation suppresses callbacks, drains transferred
rights and releases exclusion before completion; channel failure is not that
acknowledgement. Standard Sparkle's automatic-install route is unsupported.

The final native trace proves busy ordinary quit, crash before final permission,
helper death during a paused callback, timeout cancellation, channel-loss cleanup,
explicit post-acquisition cancellation, queued Install/Skip, a live actual MCP
reader, and quiet A→B replacement preserving the selected home/defaults. Source
and helper signing, Swift callback parity, actual controller blockers, irreversible
EOF failure/recovery, Settings suppression, production launcher relocation and
installed-library behavior belong to the following slices. No new permission
continuity test is required under the user's 2026-10-04 instruction.

Upstream was rejected because ordinary busy quit installed without permission;
its [frozen receipt](../assets/sparkle-reproduction.json) remains the reason for the
user-approved patch. Earlier helper-only exclusion was also rejected by the
paused-callback/helper-crash negative control. The accepted descriptor transport
uses kernel-backed shared ownership, not a clock lease or reopened path.
