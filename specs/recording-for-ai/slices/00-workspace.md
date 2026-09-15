# 00 — Workspace and runnable native harness

Status: runnable bootstrap implemented and mechanically verified; native menu
visual observation remains pending (Computer Use could not resolve the accessory
app). Dependencies: none. See [evidence](../assets/bootstrap/verification.md).
Independent capture, speech, timeline and actual-agent work can proceed from the
verified build/wire boundary; no visual acceptance is claimed.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md). This is the first implementation pickup.

## Contract and API seam

The requested monorepo builds TypeScript and Swift, launches a stable-identity local
macOS app, and exposes a harness where later probes can run without production UI.
Create Bun workspaces, Node24/ESM/Vitest, Turborepo, oxfmt/oxlint, protocol envelopes,
and the test-harness package as their first consumers appear. SwiftPM owns native
builds; a script assembles a local .app with stable bundle ID and usage descriptions.
Pin exact dependencies/lockfiles. No capture or model setup runs on installation.

## Runnable checkpoint

Create `bun run lab:bootstrap`: build and launch a minimal menu-bar fixture app,
round-trip a typed native request/result, and run a tiny TS/native test from the
root commands. Verify the active CommandLineTools can build the selected targets.
A missing SDK/tool is reported precisely instead of downloading a full toolchain
without evidence it is necessary.

## Acceptance

Root build propagates native/TS failures. A clean scratch home isolates storage.
Protocol diagnostics never contaminate JSON stdout. App launches under one stable
bundle identity. This passes independently of the actual-agent image gate in
[slice 00b](00b-client-image-probe.md); client login cannot block capture, speech or
pure timeline work. The image gate remains mandatory before full API acceptance.

## Decisions delegated and scope firewall

Working app/bundle labels, package versions and basic build scripts are delegated.
Bun orchestration, Node24 runtime, Swift native boundary and shared schemas are fixed.
Do not add Rust, a web desktop shell, empty packages, native installers for unrelated
platforms or service-manager deployment. Placeholder app code is promoted into the
real app; discarded bootstrap variants remain only in test harnesses if useful.

## Visual review

Judge only successful native launch and readable placeholder status, not final UI
style. If a shot is retained, run unprimed screenshot-critique last; compare with a
reference only if one exists. Follow [verification](../verification.md#visual-gates).

## Stay green and feedback

Run focused build/protocol/native checks. Update this slice and README handoff with
commands, toolchain and evidence before moving on. If the minimal .app cannot be
built with CommandLineTools, retain the exact failure and resolve native build
prerequisites before dependent capture work; TS-only work may proceed independently.
