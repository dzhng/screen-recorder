# Agent-first CLI onboarding rationale and evidence

Status: closed. Consumer onboarding and the reusable Docker eval harness shipped
in `f60b8b02b7fdf49f0ad43937582d57cdb39f500d`. The audit used source
`10190c8fd949484afb542f60e5f30e1b6bee189d` as its baseline and the published v0.1.1
release for released-runtime checks. These are bounded observations, not certification of
every media operation.

## Why installation belongs in both entry paths

The consumer contract is **README → complete screenrec skill → released app and
CLI → installed operation schemas**. An agent can also start with the skill alone,
so both paths need installation guidance. The baseline assumed either a developer
checkout or an existing launcher; fresh agents correctly reported missing setup
information instead of inventing a working procedure.

The [root setup guide](../../../README.md#agent-setup) owns skill discovery.
The [consumer skill](../../../skills/screenrec/SKILL.md) loads its
[installation reference](../../../skills/screenrec/references/installation.md)
independently. Media guidance lives behind task references, and MCP guidance loads
for MCP use. Development skills are separate from the product skill. Operation
schemas remain CLI-owned, rather than another copied command catalog.

Installing the app does not authorize recording, grant capture permissions or
prepare speech models. Existing destinations and dangling symlinks are refused
before replacement, preserving a user's installation for an explicit upgrade.
A successful transport exchange can still report pending or failed work; the
caller must inspect the domain receipt before claiming success.

## Why evaluate agents separately from native execution

The [eval harness](../../../evals/README.md) gives each agent a fresh disposable
home and case input, while acceptance bars go to a separate judge. Observed
commands and CLI receipts accompany the response so plausible prose cannot stand
in for execution. The [case definitions](../../../evals/cases.json) own inputs and
bars; [agent-result regressions](../../../evals/agent-result.test.mjs),
[container regressions](../../../evals/container.test.mjs) and
[judgment regressions](../../../evals/judgment.test.mjs) pin failure handling.

Linux containers run the released JavaScript CLI and scripted socket peers. They
cannot run the macOS app or establish capture readiness. Separate downloaded-app
smoke checks exercised relocation, bundled runtime and service health on macOS;
no recording, transcription, rendering or model preparation was performed.
Authentication enters only disposable runner state, and known secrets are redacted
before saved reports. Model runners have network access; portable controls do not.
Docker isolation is not a claim about every possible secret in model output.

## Findings that changed the approach

An install probe exposed unsafe destination checks inside a shell AND-list under
`set -e`. Independent checks now stop before an existing destination can be replaced.
Independent review also reproduced eager stdin buffering that stalled CLI help,
missing Claude command evidence and rejection of successful Codex turns after
reconnect diagnostics. The harness retains stdin behavior and command evidence,
and distinguishes terminal failure from recoverable diagnostics.

The README fixture initially omitted its linked consumer folder. It now preserves
that repository layout without preinstalling the skill. That correction matters:
a README-entry trial must exercise discovery and installation guidance rather than
silently supplying an installed skill.

## Retained acceptance and limits

[Original host trial judgment](evidence/judgment.md) and [host evidence](evidence/)
preserve first-run responses, baseline failures and caveats. The
[Docker results](evidence/docker-agent-results.json) preserve provenance and the
original failed README response. The final acceptance combined sixteen unaffected
trials with four corrected README trials: **five distinct cases × two agents × two
fresh trials = 20/20**, rather than twenty runs of one case or one uninterrupted
suite on a single final image.

A further fresh Codex trial exercised the final reconnect parser. Replaying the
saved runner/judge transcripts preserved their responses and command evidence.
Model-free regressions and portable fixture controls passed; no full native/source
suite was run because product executable behavior did not change. These sampled
results establish only the tested setup and portable CLI behavior.

The [audit snapshot](https://github.com/dzhng/screen-recorder/tree/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/agent-first-cli-audit)
retains the detailed original run account and machine setup observations. Generated
raw transcripts remain local and ignored; compact evidence remains in-tree. This
work produced no visual product change or media-quality claim.

## Decisions outside this closeout

[Automatic updates](../auto-update/README.md) owns the later installed-update
plan, stable-release policy and explicit skill-management workflow. Tagged release
publishing alone does not update installed apps, and this sampled onboarding audit
does not prove those later contracts or full native agent workflows.
