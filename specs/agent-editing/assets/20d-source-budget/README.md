# Canonical source verification budget

Canonical proof includes platform segment work that does not scale with the size of its lossless payload. A fragmented source with only four seconds of packed PCM can require much more than the old short native-operation deadline. Source export now uses a scoped canonical segment-work allowance plus the existing two-byte-pass budget. Recording normalization, acquisition import and package verification consume this one exporter. Legacy journal-only calls retain their previous worker deadline; global worker and public client defaults are unchanged.

The ten-minute segment allowance is a bounded observation policy supporting the measured per-role workload, with up to two sequential roles. It is not a universal timing guarantee or a new recording limit. Actual journal and canonical file sizes supply byte work; caller clock metadata does not. Native timeout errors now retain the configured operation/budget, while cancellation still kills and drains the existing worker before releasing capacity.

## Evidence

[verification.json](verification.json) names complete inputs, outputs, hashes and commands. The 100000-run source comes from the banked [materializer proof](../20c-materializer/README.md). Its fixture publication receipt is serialized from that verified result and independent hashes; this is deliberately not a second publisher-lifecycle experiment. Native publication verification rechecks it before use.

The actual public recording service times out under the old deadline, then reaches ready under the scoped policy with all intervals and the same canonical hash. Repeated reads preserve the published generation. Public recording.delete cancels an observed native verification child and returns after that child exits; the external fixture donor remains unchanged. Recording job.cancel is unavailable before project-service cutover, so no claim is made for that command. Worker timeout/cancellation tests, legacy source processing and the canonical recording package remain green. No live capture, new inference or media-quality judgment is involved.

## Separate remaining boundaries

This is source normalization readiness, not complete 100000-run acquisition/package closure. The same canonical movie produces a 15428144-byte native probe response containing 200000 physical segment rows: 100000 occupied runs plus their empty gaps. The existing 8 MiB transport rejects the response, and independently the asset schema permits at most 100000 physical segment rows per stream. Both refusals are retained. A later metadata-delivery checkpoint must reconcile those existing contracts, preserve empty intervals and exact clock meaning, and reuse bounded file/descriptor evidence delivery. Widening a global frame or fixing only one limit is not sufficient.

Recording source-generation cleanup also still needs its own orphan lifetime gate. The acquisition root lease protects a different cleanup domain; it does not claim to cover recording generation reclamation. Actual capture activation/recovery and large-work finalization remain separate.

[Combined-root verification](root-verification.json) confirms public readiness, deletion cancellation and worker preservation checks with the integrated worker.
