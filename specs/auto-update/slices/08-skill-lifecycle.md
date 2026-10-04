# 08 — Teach and evaluate explicit skill management

Unlock: both agents install/discover one canonical skill and inspect/refresh it only
within the explicit request. Independent portable branch; app updating never changes
skill files. Root README and consumer skill/reference changes ship together.

## Seam and artifact

[npx skills](https://github.com/vercel-labs/skills) owns discovery and links. Use
skills 1.7.0 initially, bound by [research identities](../assets/research.json),
then verify before recommending a later version. Pin repository `main` to one commit;
fetch only complete `skills/screenrec` via sparse checkout or recursive GitHub
contents retrieval, and install from that local folder. No whole media clone,
`--copy`, custom manager command, `skills check` inspection or ignored dry-run flag.
Node/npm availability for `npx` is a separate prerequisite from bundled app Node.

Project canonical folder is `.agents/skills/screenrec`; detected/selected agents'
skill paths resolve there. Verify actual symlinks because upstream can fall back
to copies. Whole `.claude` or other config directories are never links. Local
sources have no remote update tracking; explicit refresh repeats fetch/diff/add.

Inspection stages the entire pinned upstream folder and prints a textual diff,
additions/removals and local extra files, without modifying installed files or
metadata. Surgical edits preserve local extras/custom content. Explicit replacement
backs up the entire old canonical folder, then replaces it using `npx skills add`,
including removal of upstream deletions/local extras and verification of links.
If add fails, restore the prior canonical folder/link topology. Preserve unrelated
agent configuration; do not overwrite through a discovery symlink blindly.

Human artifact: actual command transcript, pinned source identity, folder/metadata
hash manifests, diff and link targets from disposable projects. First-run skill
instructions also install/check the released app/CLI without a source build.

## Proof and evals

Reproduce [prior local observation](../assets/skills-links-proof.json) with the
immutable consumer source at its recorded baseline and published installer. Its
report lacks complete runnable inputs, so it is limited evidence, not a frozen
winner. Freeze this reproduction, then compare production README/skill steps on
matched folders and captured outputs before model trials. Permitted difference:
current explicit backup/diff behavior and canonical project discovery requirements.

Model-free cases cover all references, unavailable Git/API route, pinned-main
consistency, comparison immutability, additions/removals/extras, surgical edits,
replacement/failed-add restore, canonical links and unrelated settings. No
app CLI is needed for skill installation/comparison.

Extend [evals](../../../evals/README.md), its fixture staging and case data. Add
actual execution cases for first project install, read-only customized diff,
surgical update, explicit backed-up replacement and waiting/disabled update-health
interpretation. Use real pinned `npx skills` for link evidence, not a stub that
claims installation. Controlled source mirrors may replace acquisition/network
only; label them and retain their exact snapshots. Bars stay judge-only.

Run model-free harness checks first, then one fresh trial per changed case in each
Claude/Codex CLI. At final acceptance run all affected/current cases twice freshly
in both agents with final artifact hashes; report distinct cases × agents × trials,
not a success count assembled from mismatched revisions. Infrastructure failure
never counts as pass. No host mounts, Docker socket, personal skills or library.

## Verdict and freedoms

Keep existing Linux refusal, portable schema/transport and failed-job semantics
green. Delegated: fixture/case names and harness staging; supported real installer,
canonical topology and overwrite semantics are fixed. Human feedback changes this
slice if customization is lost or the documented workflow needs a bespoke command.

## Pickup and scoped evidence — 2026-10-04

Independent implementation is committed; assembled-feature acceptance remains open.
The app updater has not shipped. Consumer guidance interprets only advertised
installed schemas and explicitly labels the controlled update-health projection.

- [x] Freeze limited prior reproduction before production comparison:
  `27e1554d`, [runner](../assets/reproduce-skills.mjs) and
  [complete reproduction receipt](../assets/skills-reproduction.json). The recorded
  baseline tree and actual installer reproduce references, canonical links,
  explicit reinstall and unchanged unrelated settings.
- [x] Ship root onboarding and consumer lifecycle together: `55ccc6cf`.
  [Matched baseline](../assets/skills-matched-baseline-parity.json) and
  [current folder](../assets/skills-production-parity.json) receipts execute actual
  documented install/diff/replacement/failed-add restore commands. Cleanup failure
  retains the backup and reports incomplete recovery. Rollback-copy falsification
  went red on lost local content, then green after restoration.
- [x] Execute pinned-main sparse and Git-free API acquisition:
  [Git receipt](../assets/skills-acquisition.json) and
  [API receipt](../assets/skills-api-acquisition.json) fetched the same complete
  baseline files and hashes. Controlled API tests reject unavailable/incomplete
  inputs and enforce one commit across recursive requests. These live receipts
  bind the then-published baseline, not publication of this new consumer folder.
- [x] Preserve portable contracts: 19 fast model-free checks and six Docker CLI
  controls pass. The explicit real-installer integration proof passes on macOS and
  [unprivileged Linux](../assets/skills-linux-proof.json); it lives outside the fast
  suite because a scratch npm home requires registry access.
- [x] Run one fresh focused trial per case in both agents:
  [8 cases × 2 agents × 1 trial](../assets/skills-model-trials.json). Runner consumer,
  README and case hashes match clean `55ccc6cf`; image identities differ, while
  [runtime module/tool hashes](../assets/skills-image-inputs.json) match, including
  the pinned skills CLI digest. `2c93a125` fixes the observer dropping Claude's
  successful Read/Skill/Grep evidence. Independent replay of the same saved raw
  transcripts corrects the original two false-negative judgments; original
  transcripts/judgments remain retained. The [replay runner](../assets/rejudge-read-evidence.mjs)
  refuses changed case data, preserving the original acceptance bars. This is scoped evidence with explicit
  runner and observer identities, not a fabricated single-source final run.
- [x] Review shape, diff and docs; independent Codex review findings about rollback,
  registry coupling and backup teardown are resolved. Observer follow-up review
  is clean. [Choices](../choices.md) records the three invented decisions.
- [x] After integration, reconcile controlled health fixtures with the actual
  service projection: `status: "ready"`, `version` and `update`, with existing
  blocker-owner labels. The staging regression failed on the old invented
  `service.healthy` shape, then passed with actual contract fields. Earlier model
  receipts remain scoped to their original fixture inputs. The fresh
  [2 health cases × 2 agents × 1 trial](../assets/health-integration-trials.json)
  passes all four controlled interpretation tasks. It binds the dirty tree's
  runner/contract hashes and retained raw evidence; it provides no installed
  schema or native-update proof and is not the final repeated matrix.
- [ ] Exercise live remote onboarding against the published current consumer
  source and run every
  affected/current case twice freshly in both agents with final artifact hashes.

Failed/superseded runs remain in ignored eval results and are excluded from the
focused matrix. Keep the two final result directories named in the matrix receipt
when removing this worktree; they retain raw transcripts, actual project/link/
backup receipts and separate judgments. No app install, permission grant or updater
implementation was part of this slice. Model containers had no host mounts,
personal skills or recording-library access.
