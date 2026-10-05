# Native capture fixture

The production AppKit view consumes immutable rendering facts and reports explicit
intents to its caller. Current operations carry `ControlsAction` unchanged; camera,
source-mode, countdown and Library intents await the controls/shell integration.
The existing status menu remains the product presentation. This checkpoint proves
geometry and supplied-callback behavior, not capture or device admission.

## Focused proof

`node apps/macos/tests/capture-view-shots.mjs` passed in this isolated checkout.
It compiles the production view against the existing controls module and drives
native controls offscreen. Camera Only selection, microphone disabling and explicit
camera identity reached the recorder unchanged. The rendering input stayed equal
to its original snapshot. Locked inputs and unavailable Start emitted no actions.
Every native control could be fully revealed by scrolling; Start remained actionable
in the 440-point short viewport. Full and bottom short-screen images are retained.

Red/green evidence: the initial contract failed because `CaptureView.swift` was absent.
Disabling the production enabled-state binding made the locked-input assertion fail
with `Locked take inputs and unavailable Start cannot accept actions`; restoring it
passed. Capping the production scroll document to viewport height made the
reachability assertion fail at `microphone.toggle`; restoring its content height
passed. Those falsifications were restored before retained candidate captures.

`candidate/native-metadata.json` holds observed native frames and backing scale.
`candidate/source-revision.json` identifies the revision and exact source/fixture
hashes; the revision preceded this new fixture commit, so hashes pin the candidate.
All facts are explicitly synthetic in the outside-of-product image caption and
metadata. Windows were offscreen at (-10000, -10000), with prohibited activation,
no pointer input, no service, no device reads, no permissions and no audio.

## Comparison

Target: the frozen selected `camera-idle-sharp.png` and `camera-only-sharp.png`.
Complete actual-size candidate images remain primary evidence. Comparison images
translate the reference board crop into matching context; only bottom canvas padding
is added to the candidate, without resizing native content. Synthetic fixture
captions, reference board labels, arrow/shadow, palette and SF Symbol rasterization
are excluded from this geometry verdict. The native shell owns arrow/shadow later.

| Landmark | Frozen relationship | Candidate / delta | Geometry verdict |
| --- | --- | --- | --- |
| Capture silhouette | 352 units wide, 19 corner radius | 352 native points, 19 radius; native idle content 731, Camera Only 678 points | PASS width/corners; intrinsic-height difference of 2 pixels is native border/text rasterization, no density change |
| Panel interior | 17 inset inside border, 18 header inset | 17 content + 1 native border, 18 header + 1 border | PASS |
| Source grid | Two equal columns, 9 gap, 81 tile height, 12 corners | 153.5-point equal columns, 9 gap, 81 height, 12 radius | PASS |
| Device rows | Minimum 55 height, 9 gaps, 11 corners | 55 height, 9 gaps, 11 radius | PASS |
| Switch | 42 × 25; distinct positions | 42 × 25; 19-point thumb at opposite positions | PASS |
| Start | 44 high, full interior width | 44 high, 316 wide | PASS |
| Content/footer | Four rows, Start, Open library, Quit reachable | Complete at full height; all controls revealed in short viewport | PASS |
| Long names | Preserve full-size controls and reachable selectors | Native popup title truncation, full title available as accessibility help and menu choice | PASS |

The full context and grid/device/action crops show matching card relationships and
control density. All four sides and complete footer are visible. The native title
and popup font rasterization differ; native popup indicators use SF Symbol chevrons.
The gray inactive SF Symbols are visibly softer/smaller than the reference strokes,
and the primary treatment differs in color. These are retained as
slice 12 icon/palette observations rather than geometry acceptance claims.

`comparison/metrics.json` provides grayscale/edge telemetry. Idle MAE 9.20 and
edge-energy ratio 0.967; Camera Only MAE 9.94 and ratio 0.973. These locate raster
movement and do not decide acceptance. Native/reference local boundaries remain
the geometry evidence. No prior candidate iteration is promoted to the reference.

## Actual native before-image

OPEN for the shell cutover. `NSMenu` exposes no public offscreen view image;
tracking `popUp` can constrain the menu onto a visible screen. This fixture adds
a production view without replacing the existing menu, so no automated visible
menu tracking was performed. The reconstructed HTML was never used as a native
baseline. Capture actual unchanged-menu evidence before slice 05 deletes its renderer,
then judge native before/after at shell/integration. This is an explicit plan
refinement, not a passed baseline gate.

## Remaining gates

The exact full five-shot set, both references and all eight context/crop comparisons
were inspected by an unprimed agent as the last visual acceptance check, then
rechecked after the full-height capture adjustment and action changes. It found no
blocking silhouette/density/clipping/typography defects. The first critique's heavy
source title/shortcut and oversized status dot were fixed, compared and rechecked.
The remaining medium-confidence observation is weak scroll discoverability: the
native overlay scroller is absent in stills, leaving the partially visible row as
an overflow clue. Behavioral scrolling is proved separately by the fixture.

Parent opened the non-blocking Preview set at 21:45:58 UTC and owns its closeout.
The full-height capture now uses measured natural height, rather than ending one
point early. Action fixes leave the retained idle image byte-identical.

Existing `ScreenRecorderControlsTests` passed, including menu/selection/defaults,
permission/countdown and Settings contracts. `settings-view-shots.mjs` passed its
existing offscreen scroll checks. Focused JS lint/format and `git diff --check`
passed. No whole-system suite, app install or physical recording was run.

Closeout applied refactor-clean, code-review and write-docs. No duplicate domain
owner or compatibility mechanism was introduced. App README points to the single
production view and its fixture contract. Independent Codex review found duplicate
popup labels losing identity, microphone enabling the wrong default input, absent
selected-source facts and inaccessible switch values. Each was confirmed with a
focused red regression and fixed; the same focused check passed afterward. Codex's
normal runner was sandbox-blocked, but its direct native linked probes reproduced
the defects. The implementer's unsandboxed narrow runner is the retained green
proof. Toggle roles/values derive from immutable facts; real VoiceOver/keyboard
behavior remains an integration gate.
Live devices, permission recovery, capture, focus, keyboard traversal and final
appearance remain owned by later slices.


## Review regression evidence

Duplicate camera labels: selecting “Another camera” initially emitted the duplicate
camera's identity, failing `A chooser preserves identity when device labels repeat`.
Separate native menu items preserve each supplied choice and the exact final ID.
Named microphone off: enabling initially requested the system default, failing
`Enabling a named microphone preserves its displayed identity`. It now emits the
selected supplied microphone intent. A second selected display initially reverted
to the first label, failing `Rebuilding preserves the owner-selected source device`;
a rendering-input index fixes that. On/off switches initially returned no accessible
value, failing `Assistive clients can read the supplied microphone on state`;
checkbox roles and boolean values now describe the input. All restored green.
