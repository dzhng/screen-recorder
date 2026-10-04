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
