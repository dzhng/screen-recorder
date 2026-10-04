# Apple SpeechAnalyzer diagnostic

The slice names Apple SpeechAnalyzer as the first bounded alternative if both
pinned candidates fail. This probe ran it — `SpeechAnalyzer` driving
`SpeechTranscriber` over local files on macOS 26 — against the same four AMI
speaker-B clips, the same speaker-B reference selection and the same alignment
the two pinned candidates were measured with. Counts, hashes, asset state,
ablations and raw-output paths are in
[apple-diagnostic.json](apple-diagnostic.json). The Parakeet and WhisperKit
figures it compares against come from the
[natural-speech diagnostic](natural-diagnostic.md); the fixture's provenance is in
[ami-candidate.md](ami-candidate.md).

Like that diagnostic, this one answers **which tokens were emitted** and nothing
else.

## What it shows

Apple sits between the two pinned candidates and far closer to the fluent one: it
matched **18 of 185** reference `um`/`uh` against Parakeet's 132 and WhisperKit's
zero. It is not filler-blind the way WhisperKit is — it opens clip 01 with `"Um,
okay, um, yeah."` — but it drops the large majority, and on the two shortest clips
it emitted none at all.

The interesting part is *where* the fillers go. With
`ReportingOption.alternativeTranscriptions` enabled, the alternatives carry
`um`/`uh` at roughly twice the top-1 rate, and they do so exactly where top-1
dropped one: top-1 `"so..."` against alternative `"so, um..."`, top-1 `"Yeah,"`
against `"Um, yeah,"`. So the filler reaches the hypothesis space and loses the
selection. This shows some fillers in Apple's returned alternatives that were absent from
its primary transcript. The tested settings did not promote those alternatives
to the primary result. It does not establish that every public configuration or a
separately validated selection policy would behave the same way. Seven
configurations produced exactly two outcomes: every `SpeechTranscriber` variant
emitted the same 18 regardless of alternatives or of an `AnalysisContext` seeded
with filler strings, and every `DictationTranscriber` variant emitted **zero** —
including with punctuation disabled, which is the closest thing the SDK offers to
an unformatted stream, and with the `.atypicalSpeech` content hint, which is the
one documented lever aimed at non-fluent speech.

## What it cannot show

Nothing here touches acceptance. The reference timings are AMI's **automatic**
forced alignment, so no filler precision/recall, no boundary error and no
audition claim is reported.

Resource numbers are worse than merely cold: Apple runs inference in a system
speech service, so the client process's RSS omits the model entirely and is not
comparable to the in-process Parakeet and WhisperKit figures, and its wall clock
excludes whatever that service had already loaded. The same out-of-process split
bounds the offline claim — a rerun under `deny network*` produced byte-identical
output, which shows the client needs no network and does not prove the daemon
made none.

No engine is selected here.

## Asset state, and a trap in reading it

English assets were already installed; nothing was downloaded and no user setting
was changed. But `AssetInventory.status(forModules:)` reports `.supported` — not
`.installed` — until `AssetInventory.assetInstallationRequest(supporting:)` has
been called once in the same process, after which it reports `.installed` for the
same module. Ablation ruled out the module configuration and the preset as the
cause; it is call order alone. A caller that trusts the first `status` reading
will conclude assets are missing when they are present, and
`assetInstallationRequest` returns non-`nil` even then, so non-`nil` does not mean
an install is required. Provisioning state has to be read after that warm-up call,
or from `SpeechTranscriber.installedLocales`, which was correct from the first
call.

## Where this leaves the gate

The gate still needs manually labeled filler boundaries, and this probe does not
supply them. What it does supply is a bound on the alternative: of the three local
engines now measured on real hesitant speech, only Parakeet reproduces fillers at
a rate that could support verbatim edit ranges, and Apple's shortfall cannot be
configured away through the public API.
