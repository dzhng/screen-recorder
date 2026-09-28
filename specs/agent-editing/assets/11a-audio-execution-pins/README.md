# Audio decoder execution identities

A decoder change affects admission and bounded work even where samples remain
unchanged. Legacy WAV excerpts and movie previews therefore use new recipe policies.
Transcription includes the decoder execution identity in recording and selected-asset
job inputs, independently of model digest and portable transcript schema policy.

Portable `transcript-v1` metadata stays valid. Existing published or retained generations
remain readable; the current recipe admits new work without erasing the old result.
The tests seed historical job/artifact recipe keys around genuinely ingested fixtures,
then verify distinct new jobs/generations, fresh transcriber execution, and unchanged
old-generation words after cleanup. Removing decoder identity from both paths yields
`ready` instead of new work (`red.txt`). Portable page, transcript, audio, and preview
suites pass (`tests.txt`); no fresh native model inference is claimed.

The service's source/project audio and project movie implementation IDs are integrated
by their service owner. Visual source evidence and project transcript projection
policies stay unchanged: the former does not use this decoder, and the latter already
pins its source transcript generation. This pass adds no new cache owner or schema.

Independent review found one stale direct-render policy in the public retained-package
audio harness. It now imports the policy from the core audio owner instead of
duplicating a version string. Core build/import, harness syntax/lint, and the focused
suites pass after that correction. This pass does not claim a new full package journey.
