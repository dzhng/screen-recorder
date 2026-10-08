# Implementation choices

Record consequential decisions missing from the agreed contracts, with plain-language rationale and final verdict. No choices recorded yet.

- **Automatic model preparation belongs to `transcript.review`.** The convenience feedback call starts Yap's registered pinned model preparation and reports `preparing`; callers do not need to discover `model.prepare`. Existing `transcript.get` stays read-only.
- **Project cursor review reuses the compositor through an ephemeral document.** The caller trail replaces existing pointer trail settings in a temporary compiled revision and is never persisted; this preserves geometry, capture gaps, cache and native delivery owners.
- **Source cursor review uses native source-frame compositing.** The source frame request carries a bounded, evidence-derived overlay into the native renderer, which composites it before PNG delivery. This keeps the artifact contract honest: callers receive pixels that visibly contain the trail, while the source file and project remain untouched.
- **Source cursor history is read directly from capture evidence for this path.** The service preserves observation gaps by splitting runs at non-inside samples and refuses requests without captured-video authority. The project path continues to use the richer pointer-preparation/compositor schedule because it must account for authored clip geometry and processing.
