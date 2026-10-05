# 03 — Prove coherent launcher and client entry

Unlock: no launcher loads a partial bundle and no old client survives into an
unsafe mixed release. Depends on 01; this is a focused concurrency reproduction.

## Seam and artifact

The [release launcher](../../../scripts/release.mjs) reads Node and CLI from a
mutable app before contacting the service. The service runtime-owner lock in
[startup](../../../apps/service/src/startup.ts) does not cover that interval.
The seam is installed launcher → complete bundled generation, joined with Sparkle
replacement across native app exit and helper installation.

Inputs: fixed launcher, app path, distinguishable A/B bundle bytes and explicit
load/swap barriers. Output: coherent generation receipt or bounded retryable
`UPDATING` before any user operation is dispatched. A long-lived CLI/MCP process
may legitimately defer installation; never kill it or replay its mutations.

Human artifact: a bounded race runner for actual Node/CLI entry, including help
which never contacts the service, and an MCP session that stays alive between calls.

## Proof

- Launch at Node selection, CLI load, service discovery, app rename and later
  resource-read boundaries. No old/new executable/resource mixture is admitted.
  Include client discovery's `open -a` path after socket transport failure: it
  must not relaunch the old bundle while the installer owns replacement. A framed
  `UPDATING` reply is reachable service evidence, not a reason to launch again.
- Race concurrent launchers and repeat with spaces, relocated/default paths and
  `SCREENREC_APP`. Preserve explicit-socket behavior and standalone schema help.
- One-shot and long-lived clients retain their real process/load lifetime;
  disconnected callers cannot create an untracked old client.
- Updater/app/launcher crash, install failure and canceled replacement release
  coordination without a stale permanent fence. PID-file/poll-marker guesses
  are not proof of kernel/process lifetime.
- Existing launcher bytes still work with B; automatic app replacement need not
  rewrite the external launcher. A required launcher contract change needs a
  manual bootstrap and a spec update, not hidden protocol negotiation.

Keep capture/service discovery behavior and no automatic mutation replay green.
No media generation is needed. Freeze the winning synchronization implementation,
runner/barriers and failure traces before production adoption.

## Verdict and freedoms

Delegated **after measurement**: choose the smallest mechanism that proves exclusion
through Sparkle's actual swap, including ownership after the app exits. Compare a
stable external bootstrap holding kernel-backed load/lifetime exclusion with
retained immutable generation loading only if the simpler option fails. Record
losing evidence. Do not add a recurring coordinator daemon or unsafe old-client
compatibility mode. If neither fits, reslice before proceeding.

Internal naming/fixture paths are delegated; the fixed launcher interface, complete
generation and safe deferral rules are not. Human review inspects the generation
trace and demonstrated long-lived-client blocker; expectations about how quickly
an idle MCP session must update would reopen its lifetime policy.

## Launcher-only checkpoint (not complete)

The [bounded runner](../../../scripts/launcher-lab.mjs) freezes the current shell
bootstrap and a candidate descriptor-owning lock wrapper. Run its
[focused tests](../../../scripts/launcher-lab.test.mjs) after installing workspace
dependencies; the real-adapter case also needs Bun and clang. All bundles,
barriers and lock files are scratch-only; no installed app or user defaults are
used. The [receipt](../assets/launcher-lifetime-proof.json) binds source, compiled
CLI bytes, helper, runner, Node and platform.

The shell path admits a demonstrated mixture: Node loads generation A, replacement
renames B into the same app path, and A's later resource read returns B. An inherited
`flock` descriptor (a kernel-managed shared/exclusive file lock) survives direct
`exec` into Node. The candidate refuses replacement while that Node process lives,
then admits B after exit. For actual schema help, the probe rejects replacement during Node preload,
before the CLI loads, then observes successful help after releasing the barrier.
It does not measure exclusion during the help body. An initialized actual MCP
session uses the same wrapper and blocks the exclusive owner while idle.
Killing either lock owner releases exclusion without deleting its lock file.
Disabling the exclusive lock made the test fail with replacement accepted.

This establishes a useful primitive, **not** a safe Sparkle swap. The app's own
lock would end at host termination; launchd-created helpers do not inherit its
descriptor. The updater must demonstrably own exclusive exclusion before host
termination and through complete replacement. A new launch then fails before
reading Node or CLI. If a shared owner remains, the updater defers without ending
the host. Prefer acquiring in the existing installer helper at its final install
boundary over adding a guardian process, if the updater engine exposes that
boundary honestly. Public Sparkle does not currently prove this handshake.

The [protected engine receipt](../assets/protected-engine-proof.json) now proves
actual installer exclusion against a live MCP reader and through helper/host
failure and cancellation. That closes the helper-ownership research prerequisite.
Still open: framed production `UPDATING` startup failure, `open -a` discovery parity, concurrent/canonical/default-path aliases,
normal MCP EOF, canceled/failing replacement and relocation of the assembled kit.
No production launcher changed in this checkpoint. Resolve engine ownership first;
then port the primitive and rerun these frozen barriers through production.

Checkpoint choices are recorded in the [implementation ledger](../choices.md).
