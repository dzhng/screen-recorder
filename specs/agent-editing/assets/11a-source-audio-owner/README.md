# Selected-source audio admission

`MediaAudioInspection` binds immutable asset/stream/acquisition selection through the shared source selector and submits background work through the existing queue/cache owner. The default window is the selected stream's bounds; explicit windows may include leading unavailability inside the source clock. Renderer identity, support digest and requested window distinguish jobs without inventing a recording revision.

The cached-derivative helper forwards an optional admission callback to the queue's existing transaction. Asset and acquisition references use the real admitted job ID, including replay. A failed dependency retain rolls back both the new job and preceding references. References remain with a retained job so explicit retry still owns its sources; domain retirement must release them when it forgets that job.

Before cache publication, the owner verifies the native receipt's output path, source range, absolute sample bounds, frame count, native rate/channels/layout, unavailable intervals and bytes. It independently checks bounded RIFF metadata against the receipt without loading full audio samples. This is a fixed float-WAVE sink contract, not arbitrary user WAVE import. Delivery uses the existing cache read handle; service token routing is outside this pass.

Tests use real asset import, JobQueue, DerivedCache and source selection, with generated float-WAVE output at the native-renderer boundary. Completed acquisition metadata is seeded at the import boundary; journal adoption and actual native decode are separate existing gates. Tests cover cache regeneration, source/context separation, delivered bytes, original preservation, canceled late output, explicit retry, malformed receipt/file cleanup and atomic reference rollback.

Skipping file verification publishes the corrupt fixture and fails the test. Omitting the shared admission callback loses the job references and fails the test. Existing recording-audio and project-preview tests exercise unchanged callers of the extended helper.

This pass does not claim public CLI/MCP source audio, project taps, native inference, or complete slice-11a acceptance. Existing cache capacity policy still applies; full extraction is not a promise of unbounded file size.
