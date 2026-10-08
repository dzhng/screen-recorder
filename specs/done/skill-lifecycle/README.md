# Home skill lifecycle

## Overview

Yap maintains one account-level consumer skill through the same public operation
handlers used by the CLI and Settings. When maintenance is enabled, Yap may
replace the global Yap skill and every harness link discovered by the pinned
`npx skills` installer. When maintenance is disabled, Yap removes the managed
installation so the user can maintain a customized skill themselves.

## Why this shape

The skill is account state, not project state. A project-local skill or unrelated
agent configuration must therefore remain untouched. `npx skills` is the owner
of harness discovery, so Yap uses its global JSON listing rather than a
hand-maintained list that would become stale as harnesses change.

Mutation is a durable transaction because installation can touch several paths
and can outlive the request that started it. A complete staged tree, receipts,
verification, and rollback keep a failed update from leaving a partial skill.
The durable state file also lets a later status request report an interrupted or
failed operation without rerunning discovery synchronously.

The updater runs at lifecycle boundaries (launch, app update/relaunch, re-enable,
and explicit update) rather than on a periodic timer. This keeps ownership
predictable and gives the user an explicit customization escape hatch.

## Principles and invariants

- The public operations are `skill.status`, `skill.install`, `skill.uninstall`,
  and `skill.update`; Settings delegates to those same handlers.
- The default maintenance preference is enabled. Enabled maintenance may
  override an existing global Yap skill. Disabled maintenance removes only the
  managed global installation.
- The canonical global skill and all discovered harness destinations are one
  installation. Every destination is verified to contain `SKILL.md` before a
  mutation is committed.
- Project-local skills, unrelated skills, and unrelated agent configuration are
  preserved.
- A mutation returns an operation identifier and an updating state; callers poll
  `skill.status` for the terminal state and diagnostics.
- Failed or interrupted mutations retain enough durable state to restore the
  discovered paths and report the retained backup/error information.

## Pointers into the code

- `apps/macos/Sources/Yap/SkillManager.swift` owns discovery, staging,
  receipts, verification, rollback, durable state, and lifecycle reconciliation.
- `packages/protocol/src/operations.ts` defines and routes the four shared
  operations.
- `apps/macos/tests/skill-lifecycle.test.mjs` pins automatic discovery of
  multiple global harness destinations; the Settings delegation test pins the
  shared install/uninstall path.
- `skills/yap/references/skill-lifecycle.md` documents the operator contract and
  CLI polling model; `skills/yap/references/capability-catalog.md` records the
  complete public capability surface.

## Dead ends and verification boundary

A periodic background updater was rejected because it would silently overwrite
user changes; lifecycle reconciliation and explicit update are sufficient.
Using a fixed Codex/Claude destination list was rejected because it misses new
harnesses; discovery comes from `npx skills`.

The repository checks, protocol/CLI/service suites, Swift build, focused skill
lifecycle test, and documentation audit pass. The full macOS capture suite is
permission-gated: its freshly built ad hoc binary has a different code identity
from the installed production app, even though both use
`com.dzhng.yap`. Run the production smoke checklist after release to validate
Screen Recording/Camera-backed capture behavior against the authorized app.
