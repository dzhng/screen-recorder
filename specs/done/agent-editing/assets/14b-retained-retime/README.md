# Retained native retiming and public integer authoring

The native audio request owns prepared run files. Both the normal rendering graph
and noise-processing prerequisite graph read those files before their ordered
stacks. Pure splits and short views use the compiler's complete retained context;
no persistent lineage, derivative queue or per-run durable cache was added.
Durable full-output publication still belongs to the existing prepared-audio owner.

The [native proof](native-report.json) compares complete PCM against the four
accepted corrected selections, verifies excluded-source and interior-gap poison,
gain, full/late RNNoise equality, and records cancellation and invalid selected
PCM cleanup. Missing support remains explicit. The native harness is
[composition-retime.py](../../../../../packages/test-harness/editing/composition-retime.py).
[Root integration](root-verification.json) rebuilt the merged native executable and
reran both proofs, with separate executable identities recorded for the preservation
and later recipe-bound authoring runs. Independent code review inspected the implementation and evidence with no remaining
blocking finding. Existing composition, selected-audio and source-audio checks pass.
The configured Codex CLI model was rejected by the account and supplied no verdict.

## Public authoring, separate native execution

[The public report](public-report.json) uses actual CLI/MCP asset import, physical
segment paging, project creation, split and retime operations. Each retime specifies
an integer duration in microseconds. These fixture durations are explicitly
chosen as nearest integers to the accepted rate; this is not an engine rounding
rule. The normal compiler owns absolute sample boundaries and complete run contexts.

All four resulting selections have the accepted output counts. For each, the new
native composition entry produces complete stereo PCM equal to the already
accepted mono WAV duplicated without gain. Pure-split output equals unsplit output;
concatenated left/right requests equal the full output; a short view equals its
exact slice. The comparisons include all untouched neighbors. This closes the
integer-authoring/native mapping proof; it does not advertise public retime
rendering or replace the final worker/service journey.

[public-evidence.zip](public-evidence.zip) retains actual transport requests/replies,
compiler-produced native plans, receipts and service log, with a per-member hash
manifest. Matched PCM is already retained in the accepted source packet; the proof
runner regenerates outputs and compares every byte rather than retaining duplicate
WAVs here. [Source identities](sources.json) pin the harness and relevant owners.
The current authoring run discovers and binds the native retiming identity before
executing each plan. It uses the isolated14e Wire worker for import/authoring;
the installed and frozen workers remain unchanged.

## Failure controls and limits

Temporarily restoring the old native rejection makes the native proof fail for
that reason. Separately, adding one millisecond inside the generated public retime
implementation makes the authoring proof reject 75,640 frames instead of the
accepted 75,592. Both mutations were restored, and clean runs pass. Their logs are
[native](native-mutation.log) and [authoring](authoring-mutation.log); initial harness
setup mistakes are not counted as regression failures.

The [resource audit](performance.md) found a many-run descriptor failure after
these PCM checks. The repaired reader lifetime now passes the same300-run plan under256 descriptors
with exact full PCM.

This checkpoint verifies the named mono 48 kHz inputs. Converted-rate normalization,
explicit follow, stereo native consumption, public readiness/deadlines and final
synchronized video delivery remain later integration gates. The separate bounded
file adapter supplies long-run memory evidence; this report does not infer a native
worker deadline from it. Existing graph mixing semantics are unchanged.

Reproduce with a fresh output directory, a compatible isolated14e Wire worker, and the isolated
composition test executable built from these sources:

```sh
SCREENREC_NATIVE=/absolute/path/to/isolated/screenrec-native node packages/test-harness/editing/retiming-authoring.mjs --out /tmp/new-retiming-authoring --renderer /absolute/path/to/ScreenRecorderCompositionAudioTests
```

Without `--renderer`, the same runner only verifies authoring/compiler contexts and
writes plans; it explicitly reports native PCM as unverified.
