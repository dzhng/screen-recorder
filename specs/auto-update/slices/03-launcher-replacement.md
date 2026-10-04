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
