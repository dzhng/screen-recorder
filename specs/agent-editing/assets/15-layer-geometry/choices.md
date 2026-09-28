# Decisions examined for this checkpoint

- One geometry processor uses `rect.x/y` for position, avoiding a second equivalent
  translation control. Opacity is an independent ordered step. Clip, track, group
  and output scopes share the same compiled primitive path.
- Sampling clamps exclude outside crop colors; destination polygons establish
  geometric alpha. This replaces optimizer-dependent CI crop masks rather than
  adding a compatibility renderer. Native code applies primitives only.
- Parent geometry explicitly materializes its preceding canvas in premultiplied
  extended-linear-sRGB/RGBAh; parent opacity remains a flattened operation.
  Coverage masks have a bounded per-executor cache and physical readers retire
  when their clip occurrences stop contributing.
- The native orientation owner supplies actual CI extent and transformed encoded
  support bounds. TypeScript does not interpret preferred transforms. Source
  geometric extents are finite positive numbers; actual encoded/raster dimensions
  remain integers. Odd source domains are valid, with even-size restrictions at
  movie encoding sinks.
- Source pixel-center clamping corrects a proved dark fringe. Identity, quarter-
  turn and oblique controls retain exact pixels. The only historical movie change
  has an exact corrected hash pair and case-specific uncompressed/encoded evidence;
  other fixtures keep their strict prior hashes.
- Project receipts contain every layer's ordered physical provenance. Core checks
  count, occurrence identity, requested time and rational sample-clock rounding;
  a second/repeated layer cannot disappear behind a first-layer-only receipt.
- Nonopaque PNG output is preserved. The current H.264 profile refuses nonopaque
  final output using the existing profile diagnostic. It does not silently add
  another background. General codec/color and wider output support remain open.
- Public capability/policy binding, catalog reset and pointer integration belong
  to subsequent integration checkpoints. No installed app, capture, speaker or
  user library state was changed by these probes.

Aggregate allocation admission is deliberately conservative: encoded-source
areas count active occurrences; rasterization areas count every declared stage;
unique coverage masks count their live bytes. Each has a separate provisional
bound. This prevents pathological multiplication before readers or surfaces are
allocated without claiming a measured memory guarantee. Inactive clip taps are
transparent graph inputs, so absence does not open a source reader.

The first independent code review found inactive-tap rejection and stale pixel
recipes/admitted geometry metadata. The tap bug is fixed and covered by a native
red/green probe. Catalog and renderer/scene recipe invalidation remain explicit
root-owned integration requirements before public enablement.

The second independent review found no additional correctness issue in the
prepare/open lifecycle, aggregate admission, inactive taps or explicit raster
size contract. Post-fix checks preserve94 prior PNG files byte-for-byte and pass
the18-case/386-frame historical corpus. The reviewer reran composition tests;
the implementing agent owns the reported native runs and visual evidence.
