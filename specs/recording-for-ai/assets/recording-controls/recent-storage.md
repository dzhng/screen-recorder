# Recent recording deletion and storage controls

The menu sends `recording.delete` with the identity carried by the chosen row. It
retains only the presentation of its outstanding requests for this app session: durable intent, producer
shutdown and filesystem cleanup remain service responsibilities. A hidden catalog
row is not a success receipt, so a pending or failed deletion stays visible with
its original ID until the service confirms completion. Retrying an uncertain
response uses that same idempotent operation. No additional confirmation dialog or
implicit delete-latest operation is introduced. After app restart the service resumes
its catalog intent; no second persistent UI deletion registry is added.

Storage is an aggregate observation of the managed library, including shared
metadata. The menu labels the last measured total and its observation time; an
unanswered scan does not replace it with zero. An explicit refresh, opening the
menu, or completion of an action requests a new scan. Scans are separate from
capture-status reads so measuring a large library does not freeze its clock.
Overlapping requests coalesce into one follow-up observation. Service-side callers
for the same scope join its actual running scan, so a timed-out UI reply does not
multiply disk traversals. The service remains
the owner of byte classification and exclusions.

Preview and both export actions remain visibly unavailable. The new menu actions
add no timeline editor or separate storage model.

## Verification boundary

The pure controls executable and `menu-updates.test.mjs` pass. The latter compiles
production controls and the menu adapter and checks actual NSMenu object identity:
a storage result preserves existing recording/action objects; changing the
recording ID creates a different submenu. The complete isolated app bundle builds.
No capture device, user media, or launched recorder app was used for these checks.

Four targeted mutations fail at their intended assertions: dropping a hidden
pending row loses its retry; retaining a confirmed deletion leaves a stale row;
rebuilding on a storage update destroys the existing submenu; ignoring nested
recording action IDs repurposes that submenu. Restoring production code passes.
Static independent review is clean after addressing duplicate timed-out scans and
menu rebuilding. Core owns the separately verified shared-observation fix.

These are interaction-state and object-identity checks, not native visual proof.
The owning commands are `swift run --package-path apps/macos ScreenRecorderControlsTests`, `node --test apps/macos/tests/menu-updates.test.mjs`,
and `bun run build`.

## Remaining native interaction and visual gate

1. On a scratch library, use actual native menu actions to delete one explicit
   recording while a sibling remains. Check service receipts, source hashes and
   menu refresh; exercise a retryable cleanup failure that hides the recording.
   Restore the failed resource and retry through that retained menu row.
2. Observe storage progress while capture status continues updating. Check an
   explicit refresh and post-delete total against `storage.usage`; retain the last
   observation on a failed read.
3. Capture the actual pending, failure/retry and refreshed native menu states.
   Compare the production menu before/after, then run unprimed screenshot critique
   and offer the native images for human review. Keep broader slice 07 capture,
   shortcuts, permissions and source-selection gates open.

## Merged native interaction attempt

The merged app builds and its real NSMenu identity fixture passes. On a generated
scratch library, computer-use automation resolved the owned fixture window and
could close it. It did not expose the menu-bar control; menu-bar focusing left the
window tree unchanged, SystemUIServer selection timed out, and the app became
uninspectable through that surface after its fixture window closed. No menu action,
pending/failure screenshot, or visual acceptance is claimed. The owned app/service
were stopped and the generated scratch data cleaned up. Continue ordinary-window
and backend work; real menu interaction remains an explicit gate.
