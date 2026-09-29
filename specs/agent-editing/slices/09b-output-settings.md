# 09b — Agent-controlled output settings

Status: explicit controls and expanded public SDK coverage integrated; balanced preset selected. Encoder-selection/AAC discovery completion and final fresh skill use remain open. Dependencies:
[09](09-first-preview.md), [05](05-compiler.md), [08a](08a-derived-cache.md).

## Contract

The agent controls output through explicit, discoverable settings. Presets supply
editable defaults; they never hide the underlying controls. The user prefers a
balance of sharpness and file size for the default MP4 preset. A successful result
reports the resolved settings, and retry/replay uses those frozen settings.

## Seam and ownership

One typed output-settings owner defines validation, defaults/preset expansion,
canonical identity and native lowering. The shared registry exposes the same
schema to CLI and MCP. Preview and export consume that owner, the existing compiler,
renderer, queue, cache and export-intent publication. Do not create another encoder
service or a raw shell/filter-string interface.

Canvas dimensions, rational frame rate, crop/fit and processing remain explicit
controls owned by the composition model. Encoding does not introduce competing
geometry semantics. If output-only resizing is added, it must reuse the existing
geometry owner and specify its coordinate/timing behavior before implementation.

[Functional and combined evidence](../assets/09b-output-settings/README.md),
[expanded controls](../assets/09b-public-controls/README.md), and
[quality/size decision](../assets/09b-output-quality/README.md) retain current verification boundaries.

## Work and review surface

Inventory the native backend's applicable writable controls and expose supported
controls individually, including codec/container, video rate control/bitrate,
codec profile/level, keyframe interval, frame reordering/entropy options, and audio
codec/bitrate/sample rate/channel layout. Preserve explicit color interpretation.
Do not equate an SDK symbol with actual support: probe or verify the host/backend
and report unsupported combinations. Read-only encoder statistics, capture-only
properties and unavailable modes are not advertised as configurable encoder knobs.
Additional codec support is verified separately; the required baseline remains
SDR Rec.709 MP4 H.264/AAC. The user request for full controls is not satisfied by
only a quality enum, nor by exposing only bitrate while leaving applicable controls
permanently hidden. Record the inventory and any remaining unsupported controls.

Accept a preset with explicit overrides or fully explicit settings. Resolve once
before job admission. Omitted defaults, explicit defaults and equivalent preset
expansions have one canonical identity. Reject unknown fields and incompatible or
out-of-range combinations; never silently ignore, clamp or substitute a request.
Expose effective settings and capability limits, including distinctions between
requested average bitrate and measured file rate. Agent help must explain these
semantics without requiring knowledge of native dictionary key names.

Thread the resolved settings through pinned preview inputs, export intent,
renderer requests, cache/job identity, retries and result validation. Changing a
relevant setting cannot return a movie encoded under different settings. A later
preset revision cannot alter a retained export intent. Replay of an existing
export ID compares the normalized original request before expanding any current
preset, then reuses its frozen settings. Render/cache identity uses the resolved
settings, allowing equivalent requests to share work across export IDs without a
separate preset-version registry. Caption, gain and pointer
rendering still consume the same compiled composition.

Create a public journey:

```sh
node packages/test-harness/editing/output-settings.mjs --case explicit-and-preset
```

## Acceptance

Use actual CLI/MCP and native encoding. Discover settings, resolve a preset,
override it and supply its fully expanded equivalent. Prove canonical cache reuse
for equivalent requests and distinct work for meaningful changes. Probe the
resulting movie's codec/profile, timestamps, keyframes, color tags and audio track;
requested average bitrate need not equal measured bitrate on static content.
Retain source/render inputs when comparing encoder factors.

Verify replay, retry, cancellation, historical revisions, preserved settings after
preset changes, and rejection of unsupported combinations before expensive work.
Exercise frame reordering with the bounded pixel pool and full/range timing rather
than assuming it works because admission accepts the property. Test audio sample
counts and A/V drift when changing supported rendition settings. Preserve existing
source-pixel, membership, pointer and lifecycle gates; codec-loss diagnostics stay
visible and are not rewritten as successful color-preservation checks.

Select the balanced preset from measured quality/size tradeoffs across real text,
motion and pointer content. Keep direct controls available regardless of the preset
choice. Independent visual review at the intended display size accompanies pixel
metrics; one tiny synthetic or a single static frame cannot select the default.
Update the product skill only after the public controls work, then run a fresh
agent task that overrides a preset and verifies its output through advertised tools.

## Failure boundary and discretion

Backend limitations remain explicit. Unsupported HDR transforms or codecs do not
become ready through an unchecked option. Do not add a compatibility wrapper for
the development-only fixed-profile path: replace it at its owner and preserve the
verified baseline behavior through resolved defaults. The full editor scope stays
unchanged except for the newly explicit output controls.
