# Choices

- **Override global skill when enabled — user decision.** The enabled setting
  grants Yap authority to replace the existing global Yap skill. Turning it off
  is the customization escape hatch.
- **Four public operations — user-approved recommendation.** The shared
  contract is `skill.status`, `skill.install`, `skill.uninstall`, and
  `skill.update`; Settings calls the same handlers as the CLI.
- **Lifecycle-only reconciliation — user decision.** Reconcile at app launch,
  after an app update, when re-enabled, and on explicit CLI refresh; do not run a
  periodic timer.
- **Compact Settings state — user decision.** Settings shows a compact state;
  detailed paths, ownership, revisions, and errors remain in CLI status.
- **All harnesses through npx discovery — user decision.** Treat the global
  canonical folder and all supported harness discovery links returned by
  `npx skills` as one installation.
