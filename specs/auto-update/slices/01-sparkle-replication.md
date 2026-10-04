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

**Incomplete — upstream engine rejected at the quit-safety gate.** The
[lab runner](../../../scripts/update-lab.mjs) uses the supported `SPUUserDriver`
interface and the pinned binary distribution. Its Objective-C fixture keeps the
SDK callback boundary visible and builds with this machine's Command Line Tools;
production remains Swift and must prove callback parity independently.

Run `node --test scripts/update-lab.test.mjs` to check the reproduction. Its
busy-quit test deliberately asserts the observed defect, so a green lab suite
means the defect is reproduced, **not** that updater acceptance passed. Running
`node scripts/update-lab.mjs busy-quit` exits nonzero with `verdict: rejected`.
The output binds source hashes, feed/archive hashes, public key, platform and the
full trace. Private keys and generated executable bundles are cleaned up; bounded
public diagnostics remain at the reported scratch path.

Observed on macOS 27.0.1 arm64: a valid signed same-format update reaches ready
while busy, then installs/relaunches after explicit idle intent. Authentication,
compatibility and old/equal-version refusals preserved A. Ready cancellation then
quit preserved A in the sampled run, as did opt-out during extraction. Neither
sample proves cancellation acknowledgement. Busy ordinary quit replaced A with B
without an `installing` callback or install reply. Sparkle relaunch lost the
original environment; the lab uses an isolated bundle fixture path to observe B.

Pinned source explains the failure: `SPUUIBasedUpdateDriver` queues ready replies
on the main queue; `SPUInstallerDriver` sends cancellation asynchronously;
`AppInstaller.finishInstallationAfterHostTermination` finishes an unrequested
installation. There is no public acknowledgement barrier for the helper.

User-approved correction, still awaiting native proof: a pinned source patch in Sparkle's
installer rejects host-termination installation unless an explicit install request
has already been accepted. Before requesting host termination, that installer
must hold the same external file lock that CLI entries use, exclusively, through
replacement and relaunch. A failed lock leaves the host usable and reports an
error; there is no background guardian or new polling service. This also prevents
new CLI processes from loading mixed old/new bundle resources after the host exits.

Before acceptance, rebuild the pinned source with full Xcode and replay these
fixtures, including opt-out/quit races, canceled termination, crash, old clients
and delayed replacement. Check helper progress does not steal focus, relocated
modes/rpath and HTTPS redirects. Freeze corrected inputs and parity evidence.
The existing signing and installed-library gates are unchanged.

The runner can consume a separately built framework through `--framework`. Its
receipt distinguishes that input from the verified upstream distribution used
for signing tools. Changing the fixture framework's version and observing it in
the running app proves that the runner loads the selected framework. This proves
input selection only; protection on busy ordinary quit remains red against
upstream, independently of the expected-defect reproduction suite.
