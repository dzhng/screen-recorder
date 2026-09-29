# Enforced encoder selection

Selection is a typed request, lowered once to the specification shared by
VideoToolbox preflight and the actual AVAssetWriter. Completion under a hard
specification demonstrates enforcement of that policy; it does not provide an
observed encoder ID or hardware telemetry. AVAssetWriter exposes no selected VT
session. Preferred GPU selection explicitly permits fallback.

The installed SDK's public selection surface comprises hardware enable/require,
encoder ID, GPU preference/requirement, and low-latency rate control. The last is a
realtime workflow and remains outside offline output. GPU IDs are decimal strings
to retain the complete unsigned 64-bit identity across JSON. Discovery reports the
host encoder list and any GPU identities it publishes; this host publishes no GPU
registry IDs for its H.264 encoders, so none are invented as selectable examples.

Optional controls differ between encoders. An explicit null leaves the property
unspecified, rather than substituting a supported value. The native wire owner
preserves null instead of dropping an authored default choice from its response.
Per-encoder property discovery distinguishes writable, unavailable and unknown
writability, while actual combination preflight remains authoritative. Likewise,
AAC discovery returns concrete per-format/layout/strategy bitrate choices instead
of asking agents to guess a value behind a broad numeric schema.

## Evidence

- [Public journey](public-journey.json.gz): required hardware, disabled hardware
  with unsupported optional properties left null, a discovered EncoderID,
  preferred GPU fallback, and impossible required-GPU refusal. Existing profile,
  automatic guidance, AAC, export/replay/cancellation/timing checks remain green.
- [Direct writer probe](writer-probe.swift.gz) and [result](writer-probe.json.gz):
  required and disabled hardware complete; an impossible required GPU fails at
  the writer itself; preferred GPU completes with fallback. The probe has no VT
  preflight that could mask writer behavior.
- [Current public capabilities](capabilities.json.gz): native encoder/format
  discovery through MCP, including nullable control semantics and the look-ahead
  suggestion contract. Explicit look-ahead with quality 1 is rejected because
  the SDK would ignore it.
- [Checks](checks.log.gz): native and TypeScript builds, typecheck and 199
  composition tests pass. [Policy](policy-red.log.gz) and
  [look-ahead](lookahead-red.log.gz) regressions were observed red before fixing.
- [Independent review](independent-review.log.gz): identified that the authored
  TypeScript request type used parsed-output inference, rejecting partial
  encoder policies despite runtime support. Fixed using the schema input type
  and verified through a typed partial-policy test and typecheck. Native journey
  verification was performed by the implementing pass.
- [Matched default cohort](default-cohort.json.gz) and
  [parity comparison](default-parity.json.gz): the original balanced opening
  references, Apple-decoded BGRA/ICC/timestamps and file size remain identical at
  sampled frames. Whole MP4 hashes differ. This preserves the existing default
  quality evidence boundary; it does not claim continuous-frame equality.

The final schema refinement refuses an ignored look-ahead combination, and a native
selection-type rename removes a protocol-name collision. These do not alter the
successful encoding settings used by the retained native journey. The final frozen
worker is `/tmp/screenrec-encoder-selection-native` with SHA-256
`843b3bc21bc901e3bf24fc9c3ebd5bdfb9361b628c8e4a5403bd707df17a8270`.

[Combined-root confirmation](root-integration.json) passes the targeted build,
212 composition/preview tests,13 export-lifecycle tests, a fresh combined native
build including font admission, and the complete public settings journey.
[Fresh public skill review](skill-review.md) independently discovers software
selection and AAC choices, exports with custom controls, replays exact intent and
probes actual media. [Raw evidence](skill-evidence.zip) retains every attempt.
No implementation-based discovery or repair was used; its review states startup
infrastructure exposure, CLI-only scope and absent playback/listening.
