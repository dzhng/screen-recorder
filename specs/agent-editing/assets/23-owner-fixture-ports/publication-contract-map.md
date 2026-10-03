# Publication fixture preservation map

## Current checkpoint

The following original declarations were transferred by `204bc1ad`, integrated
as `bfe782fe`, and passed in the combined 41-case run. This table supersedes
these rows in the initial inventory below. Other pending rows remain pending.
The frozen original inventory and source/report identities stay in the
[publication bank](publication-verification.json). Changed line numbers are
historical locators, not current executable ownership.

| Original V line | Current disposition | Current suite in `apps/service/tests/` |
| --- | --- | --- |
| 707 | Transferred: publication budget | `project-export.mjs` |
| 1799 | Transferred: unregistered allocation crash | `project-export-recovery.mjs` |
| 1665 | Transferred: external commit/catalog gap | `project-export-recovery.mjs` |
| 1782 | Transferred: catalog commit/ack gap | `project-export-recovery.mjs` |
| 591 | Transferred: negative observation refresh | `project-export-recovery.mjs` |
| 661 | Transferred: cancel recovery after observed commit | `project-export-recovery.mjs` |
| 614 | Transferred: abandon recovery identities | `project-export-recovery.mjs` |
| 801 | Transferred: isolated recovery retry | `project-export-recovery.mjs` |
| 741 | Transferred: bounded backlog | `project-export-recovery.mjs` |
| 1866 | Transferred: unsafe interrupted allocation | `project-export-recovery.mjs` |
| 1119 | Transferred: abandon crash after private retirement | `project-export-recovery.mjs` |
| 1903 | Transferred: native partial receipt write | `project-export-recovery.mjs` |
| 1919 | Transferred: native linked receipt crash | `project-export-recovery.mjs` |
| 1934 | Transferred: partial receipt deletion | `project-export-recovery.mjs` |
| 956 | Transferred: heavy lane and failed preview | `project-export-recovery.mjs` |
| 2004 | Transferred: failed export storage | `project-export-storage.mjs` |
| 2045 | Transferred: substituted staging accounting | `project-export-storage.mjs` |
| 2075 | Transferred: storage shutdown drain | `project-export-storage.mjs` |
| 2111 | Transferred: committed metadata accounting | `project-export-storage.mjs` |
| 885 | Transferred: removed/replaced destinations | `project-export-lifetime.mjs` |
| 1159 | Transferred: abandon/delete/close drain | `project-export-lifetime.mjs` |
| 1590 | Transferred: canceled late publication | `project-export-lifetime.mjs` |
| 1628 | Transferred: active cache descriptor | `project-export-lifetime.mjs` |

## Initial inventory and correspondence

At `6d93a9c4`, read all of `video-export.mjs` and `project-export.mjs`, including nested parameter rows and crash fixtures. No edits or tests run; working tree had only untracked `node_modules`.

**Do not delete this suite as wholly obsolete.** Most tests protect surviving `MediaExports` publication lifecycle behavior. Only four declarations are exact ports already in `project-export.mjs`.

Locations below are relative to `/Users/david/.codex/worktrees/service-composition/screen-recorder`. `V` means `apps/service/tests/video-export.mjs`; `P` means `apps/service/tests/project-export.mjs`. “Port” means preserve its unique assertions at the project owner; recording-specific setup can disappear.

| V line | Disposition and actual contract |
|---|---|
| 525 | **Covered — P733.** Metadata-only cursor pagination, filter binding, stable continuation despite earlier insert, unknown owner, abandoned rows omitted, no native work. P also checks protocol cursor parsing. |
| 591 | **Port.** Recovery’s persisted negative observation is not automatically refreshed; explicit recovery regenerates its attempt and recognizes the returned original inode. |
| 614 | **Port.** Abandon waits for active recovery, forgets only that export’s recovery identities, preserves neighboring intent/job and foreign files. |
| 661 | **Port.** Canceling recovery leaves native attempt active until drain; observed external commit remains authoritative; cleanup remains pending; startup does not restart canceled recovery, explicit recovery does. |
| 707 | **Port.** Real delayed native publication overrides worker’s unrelated 1-ms default with known-byte budget and copies exact bytes. `src/publication.test.ts:5` checks formula only; `tests/publication.mjs:294` checks operation deadline only. Neither proves exporter supplies that budget. |
| 741 | **Port.** 33-item recovery backlog admits only 32 initially; repeated startup calls do not duplicate; capacity progress discovers item 33; every staging obligation eventually clears. |
| 801 | **Port.** One recovery failure does not block siblings; polling/startup do not retry; explicit recovery observes missing output without publishing. |
| 853 | **Covered — P810.** After acknowledged commit, move destination; retry/status/abandon need zero native calls and preserve output. |
| 885 | **Port all three rows.** Owner retirement tolerates removed committed destination, removed failed destination, and replaced failed destination; replacement sentinel survives. Includes zero counted private bytes. P473 does not cover inaccessible/replaced destinations. |
| 927 | **Covered — P846.** Actual staging removal followed by lost response remains committed+cleanupPending; explicit retry confirms absence and clears unfinished discovery. |
| 956 | **Port.** Recovery waits for shared heavy lane, is deduplicated, and neither requires nor restarts failed media dependency. Replace source dependency with project preview dependency. |
| 1005 | **Port.** Late commit releases source/resource pins but failed abandonment retains admitted capacity until confirmed cleanup; retry cleans only private state. |
| 1061 | **Port.** Substituted staging blocks abandonment; fence, pins, capacity, destination and cleanupPending remain truthful; retry forbidden; restoring original identity permits removal without touching substitutes/collision. |
| 1119 | **Port actual process death.** SIGKILL after native private retirement but before catalog completion leaves durable abandoning fence; restart resumes cleanup, forgets export/job, preserves owner and foreign destination. |
| 1159 | **Port.** Concurrent abandon returns same promise; create/retry blocked; owner retirement and close join ongoing abandonment; close rejects new abandon; late committed output survives. P473 has only owner drain portion. |
| 1212 | **Port.** Failed collision export abandonment is idempotent, forgets job/publication, releases pins, preserves sources/collision; same exportId can later create fresh job and successful publication. |
| 1278 | **Partially covered — P552.** Failed dependency is not retried by status/export retry, explicit dependency retry enables export. Add repeated `create(request)` assertions from old test; P currently does not prove replay leaves failed dependency alone. Recording `SourceProcessing` identity itself is obsolete. |
| 1318 | **Port.** 32 canceled uncommitted intents consume bounded allowance; abandon frees one slot; canceled exact retries still publish; owner retirement preserves committed outputs. |
| 1372 | **Mostly covered — P359.** Preview eviction after admission regenerates pinned old revision despite later edit. Unique old assertions verify exporter attempt changes and generation increments after dependency loss; carry if that scheduler contract remains intended. |
| 1424 | **Recording-only exact semantics obsolete; preserve equivalent resource-pin proof elsewhere.** Old source-evidence directories/generations and `retainsSource` are gone. Surviving project resources still need export pins through canceled retry and release after commit. P291 proves cached implementation identity, not retained resource cleanup. |
| 1501 | **Partially covered — P251/P515.** Revision pinned before dependency completes is covered. Add assertion exporter is `waiting` while heavy lane is held and dependencies progress after release. Recording history ordinal/source pin assertions are obsolete. |
| 1536 | **Partially covered — P251/P473.** Pinned revision, replay, private metadata removal and output preservation covered. Old independent cached-byte hash equals external bytes equals receipt assertion is absent in P251; add it. ffprobe’s recording duration is old renderer evidence, not needed for project publication ownership. |
| 1590 | **Port.** Cancel after native commit: durable receipt wins although job is canceled and job publication is null; output hash equals receipt. Native `publication.mjs:217` does not prove catalog/job disagreement handled correctly. |
| 1628 | **Partially covered — P410/P473.** Cache read lease and owner drain covered separately. Unique cancellation during prepare must leave **no** output and no intent; P473 deliberately allows a late commit. |
| 1665 | **Port actual process death.** Commit-before-catalog-ack SIGKILL; durable receipt initially null, storage counts metadata only, recovery commits without republishing, original job remains failed, deletion preserves output. P446 uses orderly close after thrown observation; it is not process-death proof. Native `publication.mjs:147` lacks catalog/storage integration. |
| 1693 | **Port both rows.** Removed committed output stays missing after retry; replacement output stays untouched; original receipt remains history; retirement preserves replacement. P810 moved-parent coverage does not exercise these file rows. |
| 1718 | **Covered — P879.** Concurrent identical requests share job and one intent; changed leaf conflicts. |
| 1742 | **Port.** Lost native retirement acknowledgement keeps owner deletion pending, retry completes after actual staging absence. P846 covers committed export recovery, not failed-export owner retirement. |
| 1782 | **Port actual process death.** SIGKILL after catalog commit but before private acknowledgement; restart removes retained payload+receipt, preserves durable receipt. |
| 1799 | **Port actual process death.** SIGKILL after native staging allocation before identity registration; empty unregistered directory is recoverable and explicit retry commits. |
| 1817 | **Partially covered — P291/P359.** Canceled retry after eviction uses original implementation; ordinary eviction after edit uses original revision. Preserve combined canceled+evicted+edited revision case; P291 does not edit project. |
| 1866 | **Port actual process death.** Unregistered staging made nonempty after allocation death must block retry and owner retirement, preserve sentinel and publish nothing. |
| 1885 | **Port.** Managed source directory cannot be chosen as external destination; refusal creates no intent. Use surviving asset/library directory. |
| 1903 | **Port native receipt crash (`write`).** One-byte `receipt.pending`, no canonical receipt, failed intent; same-intent retry succeeds and retirement preserves committed output. |
| 1919 | **Port native receipt crash (`after-link`).** Canonical and pending receipt agree; retry publishes exact original payload inode, staging disappears. |
| 1934 | **Port native receipt crash (`write`).** Owner retirement removes interrupted receipt/private staging without publication. |
| 1941 | **Port both intents.** Unsafe first staging does not stop independent second intent retirement; only unsafe intent remains discoverable, status/list agree, sentinel survives. |
| 1979 | **Port.** Unreadable unrelated destination does not block private retirement; inode, size, permissions and contents remain unchanged. |
| 2004 | **Port accounting contract.** Failed private staging contributes exact payload+receipt bytes; committed external file excluded; retirement removes contribution. Recording-scoped storage query is obsolete; use aggregate project-library usage. `project-storage.test.ts:46` does not create actual publication staging. |
| 2045 | **Port.** Storage accepts already-retired staging as zero but rejects same-path replacement without modifying it. Native `publication.mjs:94` covers primitive rejection, not exporter presence fallback. |
| 2075 | **Port export-observation integration.** Storage shutdown aborts and drains held `publication.usage` before teardown. `project-storage.test.ts:92` only holds managed-library scanner, not external publication observation. |
| 2111 | **Port.** Before acknowledgement count metadata but not committed movie; after clearing staging, moved destination contributes zero without access. Native `publication.mjs:109` covers primitive byte counts only. |
| 2145 | **Port both concurrent creates.** Abandon before intent exists drains matching destination admissions; shares promise; blocks new same-id create; unrelated admission remains usable; both originals reject, no intent/output survives. |
| 2217 | **Port.** Kind is durable request identity; video→processed-package reuse conflicts without changing job/row. P879 changes leaf only; P678 checks persisted video request but not kind conflict. |
| 2239 | **Recording package representation obsolete.** `"unavailable:no_narration"`, recording snapshot, recording events/images layout and generation selectors have no project format equivalent. Generic self-contained package behavior exists in `packages/test-harness/editing/package.mjs:355` onward; cleanup/pin guarantees must still survive in dedicated project tests below. |
| 2298 | **Recording-specific generations obsolete; equivalent project pin contract needs proof.** Old `SourceProcessing`/scene/index generation ordering is gone. Preserve project export revision/resources selected before concurrent regeneration and cleanup, exact selected dependency identities, pins retained until commit then released. P tests do not cover package resource pins. |
| 2391 | **Port package cleanup.** Committed package with failed workspace removal stays in unfinished list/status, retains both workspace identities and admitted capacity, storage counts private workspaces; after moving external destination, retry cleans workspaces with **no publication calls**, clears assembly/count/cleanup flags and preserves zip bytes. |
| 2535 | **Obsolete recording package format; canonical acquisition proof remains live elsewhere.** Old `PackageInspection`, normalized recording source pages and audio adapter are retired. Parameter rows are `missing-proof`, `layout-downgrade`, `audio-pages`; each refuses a forged old recording package with null handle. Do not claim exact duplication: `capture-canonical-admission.mjs:272` onward verifies independent project-package PCM/proof with different tampering cases. If parity of these attack classes is required, map them to acquisition manifest verification, not project-export. |
| 2706 | **Obsolete recording package transcript adapter.** 12 read rows = revision `{undefined,r0}` × range `{undefined,300000..1400000}` × limit `{1,3,1000}`; three search rows `"hello"`, `"hello again"`, `"world."`. Assertions compare old package transcript pagination/search/partial-word/gap behavior with recording transcript owner and rewrite narration path. No direct project-export port: project adoption/asset transcript owner is the surviving contract. |
| 2792 | **Old adapter obsolete; project retained-transcript pin proof still needed.** Regeneration+cleanup cannot remove selected transcript during export; packaged generation remains old; commit releases pin and old raw bytes can retire. No P coverage. |
| 2861 | **Obsolete recording-only automatic preparation policy.** Processed recording export itself prepares speech models/transcript, blocks before workspace allocation, and requires explicit failed transcript retry. Project packages serialize selected available retained resources; they do not inherit this recording “export triggers transcription” contract. |
| 2908 | **Obsolete recording-only automatic scene prerequisite.** Export implicitly creates scene job and refuses to restart failed scene job. Project processed-package admission is directly ready (`exports.ts:375`); equivalent generic failed preview policy already P552, with replay gap noted above. |
| 2947 | **Old recording index API obsolete; project resource-pin proof still needed.** Cancel+regenerate+cleanup keeps exact selected index through retry, then releases it. P has no package index pin coverage. |
| 3018, `create` | **Port actual process death.** Workspace reservation survives death after native create before identity acknowledgement; recovery cleans reservation; no output until explicit retry. |
| 3018, `copy` | **Port equivalent actual process death boundary.** Old assembly used native `archive.copy`; project assembly uses `copyImportedFile` for much content. Retain death after owned input population, not obsolete operation name. Recovery cleans workspace; explicit retry publishes. |
| 3018, `write` | **Port actual process death.** Archive completed but not external commit; recovery clears assembly and explicit retry publishes. |
| 3018, `commit` | **Port actual process death.** External zip exists before catalog acknowledgement; recovery preserves bytes and clears workspace without republishing. |
| 3018, `cleanup` | **Port actual process death.** Native workspace removed before reservation cleared; recovery tolerates absence, clears reservation, preserves committed zip. All five additionally assert abandoning committed intent preserves external zip and source. |
| 3063 | **Port actual surviving native child.** SIGKILL service while archive writer remains alive; workspace lifetime blocks owner retirement retryably and preserves reservation/private bytes; killing actual child permits cleanup. `package-workspace.mjs:83` proves primitive lock but not durable export reservation/owner retirement integration. |
| 3162 | **Port package substitution.** Input locator replaced after copy blocks publication and cleanup; recovery fails retryably, preserves foreign sentinel; restoring owned identity permits cleanup; no output. Adapt trigger to current project assembler. |
| 3219 | **Port equivalent source mutation refusal.** Mutation during copy must fail package, publish nothing, allow cleanup and preserve source mutation. Old native `archive.copy` barrier no longer targets project asset copying; use actual `copyImportedFile`/asset-read boundary. |
| 3266 | **Recording normalized-source row obsolete; receipt invariant remains in acquisition/transcript packaging.** Old appended normalized recording receipt triggers pinned-byte mismatch. Project assembler checks copied resource receipts; map this to the appropriate acquisition/package suite rather than preserve old `source.receipt.file` hook. |
| 3298 | **Port.** Close waits for held destination admission; pending create rejects; no intent/file appears after close. |
| 3361 | **Port real bundled startup ordering.** Persisted waiting export with ready cache must only admit after cache reconciliation. Old recording library and `"r0"` are obsolete; project fixture plus actual bundled service still needs this ordering proof. P fixture always reconciles cache before constructing queue and cannot detect production startup misordering. |

Surviving production responsibilities confirm these are live:

- `apps/service/src/exports.ts:303`: bounded recovery admission.
- `:398–467`: durable package workspace reservation, creation and cleanup.
- `:770`: external staging accounting and missing/replaced-directory fallback.
- `:808`: explicit retry/receipt authority.
- `:898–960`: allocation identity, commit receipt, staging acknowledgement.
- `:1036–1087`: observational recovery.
- `:1089–1185`: independent per-intent retirement, admission/queue drains and retained cleanup fences.
- `apps/service/src/project-packages.ts:942,996,1054`: current file-copy paths; `:1092`: native archive write.

The process-death fixture and receipt interposer cannot be discarded before their project equivalents exist. Package primitive suites provide useful lower-level proof but do not replace catalog recovery, export capacity accounting, or owner retirement integration.

## Follow-up: existing portable-project proof

This appendix refines the initial map without introducing new scenarios. No tests run.

- V2298 revision pinning already has strong project evidence: `packages/test-harness/editing/package-history-scale.mjs:324–377` creates the first package at the current revision, advances the document immediately, then exports the explicitly pinned old revision and asserts both complete manifests (including sorted inventory) are deeply equal. `package.mjs:385–422` exports old history after undo/restore/edit; later adoption compares the retained histories. These do not run source/scene regeneration and cleanup during export. The old regenerating recording source generation has no direct acquisition equivalent.
- V2298/V2792/V2947 retained contents already have strong project round-trip evidence: `package.mjs:444–445` removes donor and imports, then after adoption, handle closure, archive deletion and restart, `:542–546` checks journal hash, normalized source hash, bindings, source ID and source generation; `:559–573` checks source index generation, all metadata/entries, coverage and image hashes; `:595–621` checks both historical/current project index generation, entries, coverage and image hashes; `:630–643` checks models absent, transcript generation, word rows, raw receipt and actual raw hash. These are immutable-generation portability proofs, not export pin lifecycle assertions.
- V2792 also has `caption-seeds.mjs:333–374`: export/adopt caption-only current state into a new service, compare corrected pixels and inherited seed provenance, then assert original transcript generation and all original source rows survive. `:375–392` verifies undo restores earlier pixels. No export cancellation, regeneration, cleanup or pin-release assertion.
- V2298 scene retention has lower-level proof in `packages/core/src/source-scene-processing.test.ts:396–465`: after cancellation and rollback checks, publish adopted scene, explicitly retain `scene-generation` with owner `{kind:'export',id:'pinned-export'}`, run cleanup and assert exact source page survives; release reference, cleanup, assert no portable generations remain. This proves reference-aware scene cleanup but manually supplies the export reference, so it cannot detect MediaExports forgetting to acquire/release it.
- Adjacent owner proof: `source-index-processing.test.ts:350` queues index against an old scene generation, regenerates scene, checks retention during cleanup and release after completion. `asset-transcript.test.ts:224` and `:294` prove cleanup preserves independently published source generations; `:347–408` proves portable words/raw bytes survive absent models, pending recovery and cleanup with zero transcription calls. They do not assert export reference lifetime.
- Prepared-package coverage is separate, not evidence for transcript/scene/index export races. `prepared-package.mjs:332–348` exports and relocates; donor/source removal follows. `:440–474` checks every adopted prepared resource's remapped revision and recipe, exact audio metadata, full and late PCM bytes, revision reference, receiver-owned asset path, and zero renderer calls. Cancellation at `:353–379` concerns adoption, not export. `prepared-audio.test.ts:1118` pins the preview recipe before prepared audio becomes ready and proves it is not silently substituted; it does not test package resource cleanup.
- V3266 remains an uncovered exact export-mutation case in the inspected fixtures. `package.mjs:543` proves unmodified normalized bytes survive relocation. `package-metadata.mjs:252` corrupts packaged resource metadata; it does not mutate normalized donor bytes after export pin. Production remains receipt-bound: `acquisitions.ts:657–680` freezes normalized member size/file identity during portable selection; `project-packages.ts:1054–1065` copies the identified file and rejects member hash/size mismatch. This justifies preserving the existing mutation/refusal contract with a current acquisition member, not carrying the obsolete recording-generation helper.
- V2535 `layout-downgrade` is already exercised at the project boundary: `capture-canonical-admission.mjs:361–390` downgrades acquisition receipt schema to 1, removes publication metadata/files and repairs the resource/inventory; package.open must fail with the assertion that claimed legacy layout cannot bypass actual packed journal verification. This is stronger evidence than the initial map's generic mention of different tampering cases.
- V2535 `missing-proof`: `capture-canonical-admission.mjs:76–91` deletes narration publication proof before acquisition.import; admission fails and asset.list stays empty. Project package-specific proof tampering at `:287–316` changes acceptedFrames, updates all declared hashes/receipt metadata, and requires package.open failure matching represented-prefix/publication. The exact package missing-proof row is not present; source admission and package tampering are adjacent but should not be reported as identical assertions.
- V2535 `audio-pages`: the recording-specific `evidence/source/pages.json` layout is gone. Existing surviving semantic checks include `capture-canonical-admission.mjs:318–360` changing asset origin, binding offset and available intervals coherently; package.open must still fail for changed physical clock meaning. `packages/core/src/acquisitions.test.ts:685–720` parameter rows layout/duplicate-role/support forge portable acquisition metadata; support shifts start by one microsecond; each fails INVALID_PACKAGE and the original passes. None is the exact old normalized-audio-row forgery. Native verification still independently replays normalized evidence in `AcquisitionImporter.verifyPortable` (`acquisitions.ts:691–775`).

Preservation conclusion: current fixtures cover revision/content identity and canonical layout downgrade. They do not cover MediaExports acquiring, retaining through canceled/active export, and releasing package resource references; they do not exercise normalized member mutation after export pin. Preserve only these actual old contracts, using the current owners; do not recreate retired recording source-generation machinery or expand the case cross-product.
