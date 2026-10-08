# Implementation choices

Record consequential decisions missing from the agreed contracts, with plain-language rationale and final verdict. No choices recorded yet.

- **Automatic model preparation belongs to `transcript.review`.** The convenience feedback call starts Yap's registered pinned model preparation and reports `preparing`; callers do not need to discover `model.prepare`. Existing `transcript.get` stays read-only.
- **Project cursor review reuses the compositor through an ephemeral document.** The caller trail replaces existing pointer trail settings in a temporary compiled revision and is never persisted; this preserves geometry, capture gaps, cache and native delivery owners.
- **Source cursor review remains an open implementation slice.** The existing source frame renderer cannot composite a trail; returning raw pixels plus metadata would violate the rendered-frame contract, so the service currently refuses that selector rather than fabricating evidence.
