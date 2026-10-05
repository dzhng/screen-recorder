# Decisions and attribution

This is the canonical decision record for this plan. The archived
[quadrant map](assets/exploration/quadrant-map.md) is historical evidence; its
kickoff prompt and OPEN list are superseded by the README and owning slices.

## User choices

| Decision | Why / evidence |
| --- | --- |
| Design A: capture stays in menu, saved recordings move out | User selected A and clarified “I meant saved recordings.” Design B's separate capture-setup modal was rejected. |
| Include camera selector/toggle and Camera Only | User selected the camera-inclusive option B after the distinction from a visual reskin was disclosed. |
| Library remains open independently until closed | User selected A for independent window lifetime; this replaces the original generic “modal” wording. |
| Inline errors with explicit Allow/Retry | User selected A for demonstrated recovery. |
| Expanded concept density/spacing/control sizes | User selected A for the sharp four-tile concept. |
| Delegate routine remaining UX during exploration | User explicitly opted in at the preference checkpoint. This was not build authorization or scope delegation. |
| Hard cutover, no compatibility shims or migrations | User explicitly selected the recommended answer during write-spec. Existing recordings remain readable under current persisted contracts. |

## Agent answers during the delegated exploration

Confirmed preference pattern: immediate capture access, persistent browsing,
reference camera capability, inline recovery and compact approved density.
Each answer below was disclosed and attributed to the agent, not the user.

| Question → answer | Preference / reason | Owner |
| --- | --- | --- |
| Popover dismissal → outside click/Escape; opening Library closes popover | Immediate capture access; ordinary transient behavior | 05 |
| Library reopen → focus existing window, restore if minimized, retain tab | Persistent browsing without duplicate state | 05 |
| Library close → close/⌘W without quitting | Independent lifetime and native convention | 05 |
| Mid-take inputs → lock source/audio, retain transport | Preserve take inputs and immediate pause/finish access | 06 |
| Missing camera → require explicit available camera, inline reason, no substitution | Selected capability and inline recovery | 04, 06, 08 |
| Appearance → follow system light/dark using reviewed treatments | Native reference and consistent hierarchy | 12 |
| Short displays → scroll at approved control sizes | Approved density without shrinking controls | 01, 03, 05 |
| Keyboard use → all controls/selectors/recovery reachable; Escape dismisses | Native immediate access and accessibility | 05, 06, 13 |
| Failure placement → capture in popover, item failures in Library, shortcut failure reveals reason | Inline recovery attached to its operation | 06, 07 |

No audience, frequency of use or agent-only workflow was inferred from silence.
Native macOS and shared human/CLI/MCP contracts are repository facts.

## Planning decisions made by the agent

These are architecture/scope interpretations for this spec, not additional user
answers. They are concrete and reviewable; a fresh implementer inherits them.

- **Primary camera:** allocate one ordinary primary source, no empty screen donor
  and no companion camera. Device kind and allocation role are distinct. Keep
  primary layout 2 and companion layout 1; validate role/layout/binding directly.
  Slice 02 must prove this without weakening authority or changing persisted format.
- **Source identity:** camera primary is `{kind: "camera", deviceId}`. Optional
  top-level `cameraDeviceId` remains companion-only. This avoids duplicated primary
  device fields, keeps discovery identity explicit and requires no special source
  vocabulary to evade a reader's role assumption.
- **Browsing breadth:** expose existing recording cursor pages. Use “Filter this
  page” for the loaded page and clear it on page navigation. Full-library search
  is absent from the inspected operation contract and would expand scope.
- **Exports breadth:** retain current tracked deliveries plus unfinished recovery,
  with an honest subtitle. A moved observer is not a complete archive query.
- **Thumbnails:** use available truthful thumbnails or an equal-slot source icon
  fallback. Mock images are illustrative; no new decode/preparation pipeline.
- **Camera defaults:** no automatic first-camera choice or new persisted camera
  default. Reuse an explicitly selected device within this session only while it
  remains the selected identity; unavailable devices stay explicit.
- **Countdown placement:** Camera Only uses the display hosting the status item
  for countdown/presentation; it does not select that display as capture media.
- **Library presentation defaults:** start on Recordings; retain tab, window frame and scroll within the app session. No new cross-launch window/filter persistence is required. This follows the persistent-window choice without adding a preferences subsystem.
- **Window keyboard commands:** share the existing Settings main-menu installer
  when Library needs ⌘W/⌘Q. No duplicate activation-policy abstraction or per-window
  menu owner is necessary.
- **First checkpoint:** judge production native geometry with synthetic facts
  before live acquisition. This gives fast review without claiming capture works.

## Capture contract

Existing display/window/region source shapes remain. Add a strict camera member:

```ts
type CameraPrimarySource = { kind: "camera"; deviceId: string };
// deviceId is nonempty and bounded to the existing camera identity limit.
// cameraDeviceId at selection top level is forbidden for this source kind.
```

Microphone/systemAudio retain their current defaults and are explicit on native
start. Enabled microphone uses an explicit device or existing system-default
meaning. The service's durable replay arguments include primary camera device ID;
reusing a request ID with a different camera conflicts. Existing replay encodings
for screen source kinds remain unchanged, preserving retained receipts.

```text
Camera primary:
  recording.sourceId → source/ → primary layout-2 receipt and video.mov
  recording.camera = null; publication.camera = null
  optional narration/system media use current primary audio publication

Screen + companion camera:
  existing primary + separately allocated, device-bound companion
  independent original clocks/media, retained host correspondence
```

With system sound off, camera primary never requests screen authorization,
screen discovery/preparation, screen video or cursor sampling. Requested system
sound may use the existing audio-only SCStream and its required authorization,
after reproduction. No screen-video output/media is permitted. Camera-primary
video establishes primary zero; companion camera behavior is unchanged.

## Scope firewalls

No automatic composition/PIP/edit, source crop/mirror/retiming, audio mix/noise
treatment, global search/index, complete export archive, live camera preview,
thumbnail worker, second clock/lifecycle/recorder, fallback audio backend, migration,
compatibility menu, install/release or unrelated cleanup. Existing defaults,
permission/replay semantics and original bytes remain intact.

## Research questions assigned to gates

The exploration OPEN list is now actionable: primary authority → 02; canonical
allocation/replay → 04; native scale/accessibility → 01/03/05/12/13; video/device
clock → 08; narration → 09; system audio → 10/11; Library browsing breadth → 07.
All are unverified at planning time. A gate's concrete failure causes reslicing,
not silent feature removal. No additional user preference answer is pending.
