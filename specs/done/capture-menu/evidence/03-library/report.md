# Native Library fixture

The production AppKit Library consumes existing controls/library/export observations
through `SavedPage`, `SavedItem` and `PresentedControlsAction`. The shared
Library/Export presentation owners hold titles, details and action applicability.
The view owns only tab/filter/scroll presentation; it dispatches existing
`ControlsAction` values and performs no service calls or media preparation.
The existing menu still renders the same shared facts until shell cutover.

The focused native fixture passed. Its action recorder received exact recording
Delete and committed-export Retry Cleanup identities; unavailable actions emitted
nothing. Page filtering affects displayed observations only and clears through an
explicit paging-owner notification. Native scroll checks revealed complete action
menus and bottom content with long source/publication/finalization facts. Red proof:
removing the action's enabled guard failed `Inapplicable Library actions cannot
escape`; clipping the scroll document to the viewport failed `Full action menu must
be reachable: actions.fixture-recording-three`. Both restored green.

Existing `ScreenRecorderControlsTests` passed after the presentation extraction.
Retained menu-parity before/after JSON is byte-identical for the authored ready,
long-finalization and export-cleanup scenarios: titles, enabled actions, details
and nested rows remain unchanged. The comparator was a temporary native probe,
not a second product model. Focused JS lint/format and diff checks passed.

Candidate metadata records actual native points/backing scale and synthetic facts;
source hashes pin the rendering inputs. Native Library content is 768 × 476 points
at backing scale 1. The real offscreen native titlebar contributes 32 points; the
concept's illustrative titlebar is 45. The complete native image is retained, and
content comparisons label that chrome difference rather than scaling the view.

Quick UI comparison against `camera-idle-sharp.png` and
`finalization-issue-sharp.png`: sidebar is 146 points; thumbnail/source-icon slot
88 × 56; text follows at a 12-point gap; rows retain 13-point padding. Base rows
remain 83 points including separator. Long facts expand vertically and keep the
status/action slot clear. Header/sidebar/content separation, empty state, separate
tabs, storage action and bottom explanatory card remain visible. Native status
words wrap inside their reserved slot; committed cleanup never truncates away its
pending state. Sample thumbnails, exact native titlebar styling, palette and SF
Symbol rasterization are later variables. No synthetic thumbnail is passed off as
captured media.

A fresh critique request could not start because the agent thread limit was reached.
Per screenshot-critique fallback, the implementer argued the visible failure cases
before judging: the native titlebar might compress the layout (content-aligned
comparison preserves the chosen body proportions); long identifiers might push the
status/menu offscreen (reserved right slots stay clear, statuses wrap); the bottom
callout might disappear on a short screen (bottom capture shows its full boundary
and native scrolling is green); a blank Library might hide navigation (empty shot
retains all tabs and storage). No blocking geometry defect was found. Parent may
provide a quick independent visual opinion during integration. This is a scoped
UI verdict, not a claim of window lifetime, keyboard or live library acceptance.

The user explicitly requested lighter verification, so no additional harness
infrastructure, expanded matrix or long independent code-review cycle was added.
The already-produced complete shots/comparisons remain evidence. Parent coordinates
Preview presentation and the native shell integration.

Closeout applied the refactor-clean, code-review and write-docs lenses. The old
private saved-media renderers and ExportMenu were replaced by shared presentation
owners; Library does not consume MenuEntry. `ControlsMenu` alone converts saved
facts for its identified current NSMenu consumer. Slice 05 removes that adapter,
MenuEntry/RecordingMenu renderer, StatusMenu and old probe consumers; ControlsAction
and the shared saved-media owners remain. No service state, clock, thumbnail job,
new defaults or persisted format was introduced.
