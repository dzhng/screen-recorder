# Fresh screenrec output-settings skill review

Verdict: usable for this exercised workflow; no blocking skill defect found. This is not a whole-editor assessment or a source/diff audit.

## Boundary and prior knowledge
Behavior was learned from skills/screenrec/SKILL.md, public CLI --help and output.capabilities receipts only. Setup supplied the built CLI, native binary, fixture paths and permission to use JourneyService. Its class was read only for startup/stop/transport; no implementation behavior, specs, old reports or output harnesses were consulted. Root AGENTS.md and the mandatory repository code-review skill were read for review procedure, not API behavior. No repository files were modified. All behavior calls used the CLI with the isolated socket; MCP discovery/behavior was not additionally tested (JourneyService starts its infrastructure MCP client). No ASR, capture or model preparation calls occurred.

The supplied native SHA256 matched; see native.sha256. A fresh /tmp/srof-* service home and socket are recorded in service.json. Service shutdown completed with exit 0; stopped.json records completion. The isolated library is retained there; authored scripts, receipts and delivered evidence are in this directory.

## Actual workflow
1. Saved full help.json and skill.md; discovered output.capabilities and preserved its full response.
2. Imported both fixture files through asset.import, waited for ready jobs, and read asset.get admission metadata. Selected each returned track:1 by media kind, not by guessed identity.
3. Created a 640x360, 24/1 fps opaque project. Placed normalized source [1,000,000,4,000,000) from each asset into project [0,3,000,000). Both ranges are inside admitted physical support. This is a short output test, not a claim of acquisition-clock synchronization.
4. Selected the advertised Apple H.264 (SW) ID with hardware:disabled, explicit null GPU, average video bitrate 1,750,000, Main level 3.1, keyframe limits 37 frames / 1.5 seconds. Set openGop, prioritizeSpeed and spatialAdaptiveQuantization to null because SW discovery marks them unsupported and the skill explains leaving these to encoder defaults. Chose advertised AAC constant 80,000 bps, 44,100 Hz mono and medium quality rather than preset 48,000 Hz stereo.
5. Preview first returned processing; six further polls reached ready, followed by explicit delivery to software-preview.mp4. No accidental failing attempt or recovery was needed. All poll requests and complete raw stdout/stderr/exit codes remain intact.
6. Passed the returned resolved settings unchanged to export.create with a new durable exportId. export.status reached committed. Replayed the exact original export.create parameters: same exportId, committed receipt, jobId, destination inode, bytes and SHA256. The export is exports/software-durable.mp4.
7. Deliberately combined baseline profile and CABAC, keeping the valid software request otherwise. CLI returned nonzero with INVALID_PARAMS, “Baseline profile requires CAVLC and no frame reordering”, retryable:false. This is a real incompatible codec combination, not malformed JSON or an invented field. No silent substitution or retry was attempted.

## Discovery and usability
- Delivery is MP4/H.264/Rec.709/AAC. Composition owns size/fps.
- Presets balanced/compact/sharp are editable defaults; custom resolved settings are reusable.
- Public schemas expose video average/constant/variable/quality rate controls, profile/level, keyframe spacing, frame reordering, entropy, temporal compression, optional GOP/speed/AQ, power efficiency, data-rate limits, buffer controls, lookahead, non-droppable frame rate and quantizers. Availability is encoder-specific; schema acceptance alone is not support.
- Discovery lists Apple HW and SW H.264 encoders, hardware auto/required/disabled and GPU preferred/required. No GPU registry IDs were reported. SW has several unsupported optional controls and null/unknown writability for others; null is not false. Only the SW selection was rendered here.
- AAC choices include 8,000, 11,025, 12,000, 16,000, 22,050, 24,000, 32,000, 44,100 and 48,000 Hz, mono/stereo; exact allowed strategy/bitrate tuples live in capabilities.stdout.json. The chosen 44.1k mono constant 80k tuple was explicitly checked against discovery. Other tuples were not tested.
- The skill's null-control guidance was sufficient to render software on the first authored attempt; no source-based repair was needed.
- Discovery is large and requires programmatic filtering (especially edit.apply and AAC format tuples). This was navigable friction, not a demonstrated defect.
- The receipt distinguishes internal audio (48k stereo) from encodedAudio (44.1k mono); confusing those would falsely suggest output settings were ignored.

## Independent verification
ffprobe -v error -show_streams -show_format -of json FILE was run on each delivered movie; complete results are preview.ffprobe.json and export.ffprobe.json. Version is in ffprobe-version.txt. Both report:
- H.264 Main, level 31 (3.1), 640x360, 24/1 fps, 72 frames, bt709, 3 seconds.
- AAC LC, 44,100 Hz, one channel/mono, 3 seconds.
- Measured/reported video stream bitrate 239,562 bps versus requested average 1,750,000 bps.
- Measured/reported audio stream bitrate 79,860 bps versus requested constant 80,000 bps.
- Whole-container bitrate 328,234 bps; 123,088 bytes. These are distinct quantities, not failures to preserve requested values.
Preview and durable export are byte-identical; checks.json records independent hashes and equality of resolved settings, replay parameters and committed receipts.

Successful rendering plus the published capability contract establish acceptance/enforcement of hardware-disabled + explicit SW ID policy, not observed encoder identity telemetry. No actual encoder-ID or GPU telemetry is supplied, and ffprobe cannot establish it. Hardware-required and GPU fallback paths were not exercised.

No listening or visual playback was performed: media probing verifies formats, not natural speech joins, visual layout or perceptual quality. No claim is made about unexercised controls, crash recovery, alternate machines or the whole editor.

## Evidence map
*.request.json: authored parameters for every API attempt; *.command.json: CLI invocation (JSON stdin).
*.stdout.json / *.stderr.txt / *.exit.txt: complete raw envelopes, errors and exit status.
client.py, service.mjs, render.py, preview.py, export.py: authored orchestration.
export-create and export-replay: original durable request and exact replay.
incompatible.*: full authored negative request and refusal.
software-preview.mp4 and exports/software-durable.mp4: actual delivered media.
help.json, capabilities.stdout.json, asset-*.stdout.json: public discovery/admission authority.
