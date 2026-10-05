# 10 — Read-only loudness measurement

Status: implemented and reviewed. Question: **Does the report identify and measure the exact requested signal?**

Dependencies: [05](05-managed-output.md).

## Contract and owner

Shared audio.measure operation; core audio-inspection selection and measurement evidence; FFmpeg analyzes retained PCM.

Request pins assetId/streamId, optional acquisitionId and admitted support, or project/revision/tap plus prepared-signal recipe identity; window, channel interpretation and true-peak mode. Result records LUFS/LRA/peak, algorithm/version, exact coverage and not-measurable states. No implicit treatment. Whole-program versus excerpt semantics are explicit. An integrated selection spanning unavailable support is refused with coverage and available sections; never concatenate fragments or insert measured silence. Explicit authored silence remains signal. Mono is measured as its admitted single channel by default; dual-mono playback interpretation is opt-in and reported. Silence or inadequate gating duration reports not-measurable rather than a fabricated finite target.

## Focused proof and review

A CLI JSON reading and calibration result.

Independent BS1770/R128 reference signals, silence, too-short/gapped selections, mono/dual-mono, stereo and intersample peak. Explicit peak=true/libswresample; parse nonfinite/numeric-string stats safely. Freeze tolerance from independent oracle before held-out tests; RMS is not LUFS.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.


## Implemented signal and result contract

The operation extends the existing acoustic inspection owner; it adds no queue,
cache, model or publication system. Native audio admission/rendering still owns
PCM clocks and missing support. FFmpeg receives that validated retained WAV through
the held descriptor, rewound under the existing CLI process lifetime. Bundled
receipt verification precedes execution; missing tools fail without host substitution.

`channelInterpretation` is native by default, with explicit dual-mono permitted
only for mono. `truePeak` defaults true and may be disabled independently of
sample peak. The published measurement retains source or project/revision/tap,
exact range/sample range, coverage, PCM generation, meter implementation and
`signalRecipe` (SHA256, optional prepared resource and processing hash). Scope is
full-signal only when the exact selected bounds match its source/project domain;
otherwise it is an excerpt. Optional project `preparedResourceId` pins an existing
processed output and refuses incompatible taps rather than using live processing.

The scanner's summary has one-decimal resolution. Integrated gates need at least
400 ms; loudness range needs at least 3 s and a nonempty short-term population.
An empty integrated gate's finite −70/zero-threshold sentinel becomes null with a
below-gate reason. Short signals report insufficient-duration. Silent sample/true
peaks are null instead of non-JSON infinity. A real finite low reading and a real
zero LRA remain measurable. No target or treatment is inferred.

## Independent calibration and frozen confirmation

The parent accepted the [frozen comparison protocol](../evidence/loudness/frozen-protocol.json)
before held-out confirmation: integrated error ≤0.10 LU, LRA ≤0.20 LU, sample peak
≤0.10 dB and smooth-signal true peak ≤0.15 dB. The independent libebur128 v1.2.6
source is pinned to `67b33abe1558160ed76ada1322329b0e9e058b02`, with its MIT notice
inside the retained source archive. Its FIR peak interpolator is independent of
FFmpeg's libswresample scanner. The calibration/confirmation signals are authored
numerical fixtures, not substitutes for real speech quality or listening.

Held-out unequal stereo at 44.1 kHz and stepped mono at 48 kHz both passed. Maximum
absolute differences were 0.048 LU integrated, 0.098 LU range, 0.026 dB sample peak
and 0.030 dB true peak. The [report](../evidence/loudness/heldout-report.json)
retains complete references and candidates. Original operands are retained in a
lossless archive with hashes; candidate/runtime/source identities remain separate.

**Abrupt boundary limitation:** a 12 kHz phase-offset waveform truncated abruptly
at 48 kHz produced approximately 0.51 dB true-peak disagreement between the two
resamplers. Tapering independently defined source boundaries to 100 ms reduced
that diagnostic spread below 0.05 dB. Both operands/results are retained. Smooth
confirmation agreement is not a universal true-peak accuracy/compliance claim,
and downstream limiters/treatments cannot infer an encoded ceiling guarantee.

The public [CLI/MCP report](../evidence/loudness/public-report.json) passed source
measurement, identical MCP result, explicit dual-mono (+3.0 LU at displayed
resolution), sample-only mode, short excerpt, pinned project revision and an
explicit retained prepared output. Original source bytes stayed intact. The
final bundled FFmpeg receipt is `27350ff2f953bbd4d6ca8bfe0f6808b99b9752192657d289146b50319099f66a`;
actual native and scanner hashes are in [runtime identity](../evidence/loudness/runtime.json).
This is a tiny scratch-service contract proof, not installed-release acceptance.

## Failure evidence and verification scope

[Attempts](../evidence/loudness/attempts.json) retain fixture/infrastructure errors:
a wrong public job-state poll, an older CLI owner argument contract, a `/tmp`
symlink refused by the retained-file boundary, and a faulty nested-JSON assertion.
The accepted proof uses canonical scratch paths and a current read-only native
binary. No product security check, tolerance or source-selection rule was loosened.

Tests preceded selection/coverage, parser, admission and explicit prepared-pin
behavior. Rational coverage was additionally falsified by converting a fractional
endpoint to Number, producing the expected wrong endpoint, then restored green.
A first fault changed an irrelevant endpoint and did not fail; it was not counted
as proof. Focused core/service/protocol checks passed; no capture, ASR, audio
playback, personal library, full native rebuild or full suite was run.

## Choices handed to parent ledger

- **One acoustic owner — sound, high confidence.** Waveforms, spectra and loudness
  reduce the same pinned PCM. For a source mask with a hole, the owner refuses an
  integrated reading with exact available sections rather than inventing silence.
  The plan named audio inspection but left reduction placement open. Future
  measurements inherit its generation/cache lifetime instead of another job owner.
- **Scalar report through existing derivative lifecycle — sound, medium confidence.**
  The result is small JSON, with common provenance and an explicit meter recipe.
  Repeating a request reuses its queued/published result; job.retry controls failed
  attempts. The plan did not prescribe delivery shape. It retains the existing
  acoustic cache/publication convention, while audio.measure returns the report
  inline through every adapter. A new measurement does not create an edit.
- **Empty gates are null, peaks remain independent — sound, high confidence.** A
  200 ms tone has measurable sample peak but no complete integrated gate; silence
  makes the scanner print −70. Reporting either as a finite loudness target would
  mislead a treatment caller. The plan required unmeasurable states but left exact
  response semantics open. Reasons, units, meter identity and scope remain explicit.
- **Bounded oracle gates — sound, medium confidence.** The one-decimal scanner
  summary is compared with independent standards arithmetic. The parent accepted
  tolerances before untouched smooth confirmation. The abrupt high-frequency edge
  disagrees materially, so that limitation remains evidence; it cannot be erased
  by smooth-signal success or used as a universal encoded-peak promise.
- **Prepared pins are binding — sound, high confidence.** A caller naming retained
  processed output while requesting its dry tap must get a refusal. The old
  internal resolver ignored such a pin and chose live processing; the public
  operation exposed that ambiguity. The existing prepared owner now distinguishes
  explicit incompatible pins from ordinary unpinned dry inspection. Source and
  transcript meaning remain intact.

## Closeout review

Independent review found one binding defect: PCM admission reconstructed a project
selector without the resolved prepared resource. With several retained processing
policies, this could refuse an explicit valid pin as ambiguous. The canonical
project-audio selector now carries its resolved resource (or an explicit produced
null), including context expansion. A real catalog/queue/audio/acoustic regression
creates two retained policies and verifies the published measurement names and
uses the selected one through admission and retry. Both dropped-pin paths failed
with AMBIGUOUS_PREPARED_AUDIO, then passed with the
binding retained. The fixture's native receipt was corrected to report an empty
unavailable row for each selected clip; no product receipt check changed.

The obsolete test-only split between a media worker and a separate CLI lifetime
binary was removed; the fixture now uses the one current native executable.
Focused audio/prepared/project tests (56 passed, one existing native integration skipped), core/service/protocol typechecks and the earlier
independent meter/public proofs establish this slice's scoped claims. The metadata
fix does not change scanner arithmetic, so inference was not repeated.

Follow-up review confirmed a second reconstruction in PCM retry dropped the same
binding; retry now carries the canonical selector's prepared ID/null. The regression
explicitly exercises retry before the acoustic publication. The existing project
context assertion now includes its produced null binding. Both findings were
confirmed red and resolved without loosening a requirement.

The final independent scoped rereview found no unresolved binding, generation or
retry defects; its nine fixture cases passed. Shape review retained the existing
audio/acoustic/prepared owners. Diff review resolved all three concrete findings.
Docs preserve the read-only measurement boundary and link to executable fixtures.
