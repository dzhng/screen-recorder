The read-only capability gate is currently blocked at the runtime boundary: the current source skill describes the workflow, but no Yap executable, app, service, media, model, or generation provider is available.

### Available-tool workflow

1. **Capability and provenance check**
   - Resolve the loaded skill, CLI, app, models, local utilities, and retained assets.
   - Use actual CLI schemas; documentation alone does not establish readiness.
2. **Asset and dialogue preparation**
   - Supply or generate cinematic footage through a separately available video generator, retain its provider/model identity, then import the resulting bytes into Yap.
   - Supply interview media or a retained mono 24 kHz voice reference plus exact transcript for any `voice.generate` operation.
3. **Yap evidence pass**
   - Pin assets, streams, acquisitions, project revision, transcript generation, word ordinals, frames, waveform, and spectrogram ranges.
4. **Assembly**
   - Build a non-destructive trailer revision.
   - Seed captions from pinned transcript occurrences.
   - Use advertised text/curve animation or import an externally rendered motion-graphics asset.
5. **Review and defect repair**
   - Render bounded excerpts around joins and the opening/ending.
   - Compare source, dry, processed, and delivered audio plus frames and rendered transcription.
   - Recompute the edit if the final consonant is clipped; render again and recheck.
6. **Export**
   - Export only after the changed boundary and caption visibility are verified.

This trial stops after step 1 because the required execution capabilities are absent.

### Readiness and provenance inventory

| Capability | Evidence | Status |
|---|---|---|
| Current Yap consumer skill | [`skills/yap/SKILL.md`](/Users/server/dev/yap-capability-skill/skills/yap/SKILL.md), SHA-256 `1931ef60…`, source checkout commit `28189404e711746add46c0e8b941e1db2c8cb557` | Available as local instructions; checkout is dirty |
| Separately installed skill | `/tmp/yap-capability-trial.s1xRk5/.agents/skills/yap/SKILL.md`, SHA-256 `c23e2a06…`; only 154 bytes and says “Inspect the installed CLI before operating” | Present but old/minimal; not equivalent to current source |
| Claude discovery link | `.claude/skills/yap -> ../../.agents/skills/yap` | Resolves to that old installed copy |
| Yap CLI | `command -v yap` failed; `yap capture.status --help` returned command not found | Unavailable |
| Yap app/launcher | `~/Applications/Yap.app` and `~/.local/bin/yap` do not exist | Unavailable |
| Yap service/model readiness | No `service.health`, `service.tools`, `model.list`, or operation schemas could be queried | Unknown, treated as unavailable |
| Platform | Apple Silicon arm64, macOS 27.0.1; meets the documented macOS floor | Platform-ready only |
| Local Node tooling | Node `v24.21.0`, npm/npx `11.19.0` | Available for local helper inspection |
| Standalone FFmpeg | `/opt/homebrew/bin/ffmpeg`, version `9.0.2` | Available, but not Yap-verified |
| AI cinematic video | No callable video-generation tool, provider, model, or generated media | Missing; required |
| Interview dialogue | No source media, transcript, voice reference, registered model, or runtime | Missing; required |
| Animated captions | Caption seeding and curve animation are documented, but no project/transcript/font/runtime exists | Documented only |
| Raster image generation | The session skill catalog includes image generation, but it produces raster images rather than cinematic footage | Not a substitute for requested video |
| Trial assets | No MP4/MOV/WAV/M4A/image/SRT/VTT files in the task project | None supplied |
| Trial harness evidence | `scoped-tests.txt` reports 6 passing fixture/provenance tests, including local helper-help discovery | Validates fixtures only; does not prove native Yap readiness |
| External providers/accounts | None contacted or evidenced, per constraint | Unavailable by design |

Relevant local references are [`capability-discovery.md`](/Users/server/dev/yap-capability-skill/skills/yap/references/capability-discovery.md), [`media-workflows.md`](/Users/server/dev/yap-capability-skill/skills/yap/references/media-workflows.md), [`creative-workflows.md`](/Users/server/dev/yap-capability-skill/skills/yap/references/creative-workflows.md), [`video-use-cases.md`](/Users/server/dev/yap-capability-skill/skills/yap/references/video-use-cases.md), and [`editorial-checks.md`](/Users/server/dev/yap-capability-skill/skills/yap/references/editorial-checks.md).

### Final-consonant investigation plan

When the source and previous cut are available:

1. Pin the original asset/stream, project revision, render/export identity, transcript generation, and exact final-word occurrence.
2. Determine whether this is a **selection-boundary**, **fade/crossfade**, **processing**, **retiming**, **codec**, or **caption-only** defect.
3. Compare a complete source sentence with the rendered excerpt, including context before and after the final word.
4. Inspect bounded source and delivered audio with:
   - waveform by channel,
   - spectrogram,
   - dry/processed/rendered taps,
   - exact sample ranges and endpoint inclusion.
5. Inspect nearby frames or lip motion where available. Re-transcribe the rendered excerpt only as supporting evidence; transcript agreement does not prove every phoneme survived.
6. If the trailer ends on a provocative question, preserve its last syllable and inflection, then cut before the answer begins. Do not infer a safe boundary from low amplitude or an ASR timestamp alone.
7. Repair only the observed cause: extend the retained source range, remove or move a consonant-softening fade, or correct the replacement speech timing. Preserve room tone and adjacent phonemes.
8. Render the affected excerpt and final output, then repeat the same checks. Keep the iteration bounded and record any remaining uncertainty.

No files, app state, library state, media, models, or external providers were modified or contacted.