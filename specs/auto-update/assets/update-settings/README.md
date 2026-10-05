# Settings update preference — presentation proof

Target: one clear opt-out in existing Settings, with enabled idle-install meaning,
explicit Off consequences and truthful manual-build status. Preserve existing
settings style and scroll access to lower controls. The historical baseline is
context, not a user-approved design to reproduce exactly.

The [receipt](receipt.json) binds source, platform, runner and every image. The
[renderer](../../../../apps/macos/tests/settings-view-shots.mjs) draws the actual
production SettingsView with synthetic owner state in offscreen windows, without
service launch, desktop capture, permission inspection or preference changes.
Source revision alone is the pass baseline; listed hashes bind added/changed bytes.

## Visual comparison

Before/candidate share 560×780 content view, 1 pixel per point, fixture permissions,
shortcut facts and inactive light/dark appearance. The titlebar is outside this
content-view comparison. [Pixel observations](comparison.json) establish real
movement while the About header remains identical; lower content moves down to
make room for Updates. Distances describe change, not correctness.

| Boundary or content | Before → candidate observation | Judgment |
| --- | --- | --- |
| Left/right card edges | Existing cards span x20–540; Updates uses the same edges. | Preserved style. |
| Text and toggle | New title and owner status fit inside the card, with switch at its right. | No overlap or clipped text. |
| Top/bottom section edges | About is unchanged; Updates and its footer have clear gaps above Permissions. | No collision at either boundary. |
| Off meaning | Disabled state explicitly prevents automatic checks, downloads and installation. | Readable in both appearances. |
| Waiting/failure | Owner text remains complete within the card. | No truncation, including the long failure line. |
| Lower form | More settings need scrolling; baseline already needed it. Actual scroll reaches all General/login controls. | Bottom controls retain space below them. |

The [fresh top-state critique](critique.md) inspected every baseline/candidate
full frame and all update crops with actual image inputs. It found no new-section
clipping, overlap or truncation. Its gray-track concern is scoped to the intentionally
inactive native windows: thumb position and explicit Off helper remain visible,
and existing recording switches share this style. No custom switch styling was
introduced. The [fresh lower-form critique](bottom-critique.md) independently
inspected both new scrolled images and found all lower controls fully visible.

Saved candidate shots were opened together in Preview in the background for
nonblocking user review. No focus activation was needed. The pass accepts the
candidate on these observations; it makes no preference-persistence or SDK
cancellation claim from synthetic facts.

## Contract scope

The focused check proves explicit opt-out/re-enable dispatch, no speculative
state mutation, no second preferences write and unavailable-build refusal. Replacing
the request with a local switch mutation made it fail; restoring owner dispatch
passed. Existing pure controls checks preserve permission/menu/shortcut/window
preference contracts. Actual owner persistence, staged disarming, health projection
and updater-initiated quit are the native and assembled acceptance gates.
