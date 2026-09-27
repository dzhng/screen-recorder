# Native appearance and encoding loss

The [frozen experiment](../../../specs/agent-editing/assets/06-color/report.json)
supports preserving the platform's decoded source appearance through native Core
Image color management into an explicitly declared sRGB output. It does **not**
identify the intended profile of untagged media or accept a production output
profile. The [runner](./color-reproduction.mjs) reproduces the comparison in a fresh
output directory with `node packages/test-harness/editing/color-reproduction.mjs /tmp/fresh-color-run`.

Native appearance is the reference because replacing missing metadata with an
assumed sRGB profile can itself change the picture. In this run VideoToolbox
reported guessed SMPTE-C/601 interpretation for the untagged synthetic movie and
guessed HDTV/709 for the existing recorded fixture. Explicit sRGB assignment
changed their native-reference pixels by up to 64 and 11 channel levels,
respectively. The already declared synthetic source was unchanged. Apple documents
that the [CIImage color-space option](https://developer.apple.com/documentation/coreimage/ciimageoption/colorspace)
can override the source color space; this is a distinct assumption, not neutral
metadata repair. Destination conversion is controlled by the explicit color space
passed to rendering, as described by [CIContext output color space](https://developer.apple.com/documentation/coreimage/cicontextoption/outputcolorspace).

The runner freezes a regular reference-pixel lattice before rendering and also
measures every pixel, including text and edges. All comparisons retain the
four-level channel-error gate. Native source → pre-encode output is exact for the
synthetic inputs and within one level for the recorded frame. The rotation-only
derivative preserves compressed video packets and has a verified display matrix;
its native pixels exactly match an independently rotated source reference.
Source bytes remain immutable. No real input was silently retagged.

Encoding is a separate loss. The same recorded frame, canvas and native color
policy at two requested H.264 bitrates produced:

| Requested bitrate | Fixed samples passing | Channels over four levels | Maximum error | Movie bytes | Elapsed seconds | Peak RSS bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 Mbps | 19/25 | 9.92% | 89 | 47,578 | 1.334 | 88,702,976 |
| 40 Mbps | 25/25 | 1.38% | 56 | 88,411 | 1.186 | 88,817,664 |

The higher bitrate reduces error but still fails the whole-image four-level gate.
The elapsed times are single observations including evidence generation, not a
speed comparison; the output is one frame, not a sustained bitrate measurement.
The synthetic fixed samples pass at the lower bitrate while their lossy edge
pixels also exceed four levels. A universal bitrate cannot be selected from this
sample. Output-profile quality, size and sustained resource tradeoffs remain open.

The source reference, pre-encode PNG, native-decoded roundtrip and explicit-profile
counterexample are all retained, together with exact requests, source metadata,
resource output and hashes. These distinguish conversion from encoding rather
than hiding a red result behind selected patches. Frozen tests re-decode the PNGs,
check conversion against the unchanged gate and retain explicit profile replacement
as a failing control. Substituting that counterexample for pre-encode output was
confirmed to make the test fail, then restored to green.

Scope is the first frame of an existing captured fixture plus tagged/untagged
synthetics and one 90° metadata rotation. It does not establish HDR/wide-gamut,
other orientation/scaling cases, later scene behavior, intended untagged colors or
physical-camera fidelity. Independent visual critique and physical/listening gates
remain open. This is research harness code; no production executor or default was
changed, and no capture, playback or installed application was exercised.
