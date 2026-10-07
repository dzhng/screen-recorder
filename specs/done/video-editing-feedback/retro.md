# Retrospective: the real trailer-editing session

This is a retrospective of the Claude session that produced the SOTA/Graham Neubig trailer variants. It is not a new edit of the user's videos.

## Evidence and limits

The source repository commit, feedback hash and original session hash are in [provenance](assets/provenance.json). [Session excerpts](assets/session-excerpts.json) retain exact selected messages/tool inputs with one-based JSONL record numbers. These excerpts are not the whole session and contain no private reasoning blocks. Tool results and media have not been re-executed here.

The [project README](assets/reference-workflow/sota-graham-neubig-trailer/README.md), per-version READMEs and QA reports preserve final choices. Statements below distinguish observed messages, retained receipts and unverified historical claims.

## What the agent accomplished

- Selected strong interview material and built six requested stylistic branches.
- Used Yap/Screenrec for source admission, exact edits and exports; preserved request/receipt histories and source hashes.
- Independently found speech defects by transcribing rendered audio, comparing expected text and investigating waveform discrepancies (records 293, 2514, 2529).
- Added Vision-based face/appearance checks, per-clip sound matching and a successful external ProRes 4444 caption-overlay pipeline.
- Captured product and skill friction in FEEDBACK.md throughout the work.
- Converted ad-hoc generation into reproducible music/SFX/overlay and build scripts.
- Reported distinct reproduction coverage: three variants rebuilt with matching decoded frames/audio; three others had matching edit requests, not full rendered replay (record 2506). Preserve that distinction.

The speech-cut feedback was authored by the editing agent. The user supplied direction and later challenged an overgeneralized explanation; the user was not needed to discover or repair the original cut defect.

## Where work multiplied

| Episode / source record | Cause and lesson | Spec consequence |
| --- | --- | --- |
| Large import timed out but existed, 74–98 | Ambiguous transport completion required replay and discovery. Current import is already asynchronous; reproduce before redesign. | Admission latency/replay controls in async contract slice. |
| Empty installed helper help, 103–114 | Agent could not discover the consumer helper and replaced it with custom scripts. Current source help now exists. | Usable examples, help regression and explicit installed-skill provenance. |
| Whole-source ASR failed; smaller extracts still failed, 119–202 | Deterministic timing validation failure was marked retryable; blind splitting created about 30 extra jobs. | Structured offending intervals, range inference and bounded recovery. |
| Wrong result field, 152–157 | Similar operations used different output locations; invalid empty-ID requests followed. | One readiness/publication shape and helper examples. |
| Transcript-derived speech cuts, 278–350 and 1475 | Re-transcription caught mistakes, but abrupt isolated snippets also biased the recognizer. | Contextual verification; preserve uncertainty and use additional acoustic/alignment evidence. |
| Grade/music direction revised, 1010–1171 | A named reference was reduced to a dark/warm grade and a mood guess before sufficiently studying actual audio and source behavior. | Reference decomposition in skill; source-conditioned grade and music choices. |
| “Hollywood” became letterboxing, 1330–1529 | A stylistic word was interpreted as cropping rather than production quality. | No unrequested bars/crops; fixture proves content preservation and explicit geometry tradeoffs. |
| Face centering and levels, 1533–1752 | External scripts/manual gains succeeded but were rediscovered during each workflow. | Shared face evidence/reframe and per-clip matching helpers. |
| Export refusal, 1772 | Same intended deliverable required filename churn. | Atomic overwrite of unchanged owned outputs; foreign overwrite explicit. |
| QA claims, 2113 and frozen scripts | Frame sampling was useful, but “frame by frame” exceeded actual 4fps/excluded-transition coverage. | Enumerate actual samples, failed frames and excluded regions; transition QA is separate. |
| Reproduction initially asserted, 2238–2275 | Hard-coded paths and uncommitted one-off commands remained. Agent later identified and fixed these gaps. | Save recipes from first use; clean-state replay is acceptance. |
| Repo structure misunderstood, 31/446/484 | One collection repo was split per video until corrected. | Consumer guidance uses one project collection with video subfolders. |

## Corrected speech lesson

The agent first summarized ASR as approximately 0.3 seconds early. It later corrected that claim after the user asked how it was established (records 2512–2542).

- Original ASR called the phrase-final word “turn”; the comparison transcript/rendered-context ASR supported “trend.”
- The 1575.10–1575.44 source interval was inferred from waveform energy. Energy does not independently label its lexical content.
- Moving the cut into subsequent measured quiet made the intended word reappear in rendered-context recognition.
- There is no demonstrated constant timing bias.
- The Madison abrupt-start snippet comparison was suggestive, not conclusive.
- Re-transcription remains a successful automatic defect detector. Padding/context, alignment and acoustic checks strengthen it; they do not invalidate that success.

Do not invent independent audible labels or import the same ASR output as both input and accuracy oracle.

## Consumer skill changes implied by the retro

Start by discovering agent capabilities beyond Yap. Use available tools and script generation without an automatic install/download phase. Recommend a missing capability only when the brief warrants it.

Keep generic workflow in SKILL.md. Route speech verification, picture QA, multicam and finishing to dedicated references. Keep launch, podcast and teaser story choices in their own use-case references; derive style from brief/reference instead of defaulting all videos to this trailer's look.

Helpers must provide minimal working examples and directly usable receipts. The agent follows the pinned current CLI contract; a source checkout's help is not evidence that an older installed skill has it.

Verification is autonomous. The agent investigates discrepancies, repairs conservatively within delegated scope, reruns only changed work and delivers the best checked output with specific remaining uncertainty. The user never becomes a required listening/vision/transcript oracle.

## What to replicate before replacing

Freeze the retained picture sampler/statistics, music synthesis and reproduction scripts as historical reference inputs. Production-entry-point comparisons must match source sample times, color interpretation, frame/face masks and audio selection.

Keep successes while correcting limitations: the sampler may silently skip frames; the summary excludes transitions; largest-face selection is not subject tracking; shell QA deletes its output folder; containers can differ despite matching decoded content. These scripts are frozen references, not a second production backend and not instructions to execute unsafely.

No media has been rendered, transcribed or judged anew in this planning pass.
