# Output-settings product-skill checkpoint

Pass for this scoped workflow, with an independence limitation: this is a
limited-context consumer, not a fresh agent. I previously implemented and verified
fade/zoom conveniences and knew the project/CLI lifecycle. I had the parent’s
output-settings task and frozen-worker location. I read the product skill and
public CLI/MCP discovery for this pass; no output implementation or harness code
was inspected to discover settings. Existing service-start infrastructure was
used only to create the isolated live service. Product code and skill were not
modified. A fresh verification should follow the in-progress control expansion.

## What ran

Built the service/CLI dependency targets in the output-settings worktree. Started
an isolated temporary service using the hash-recorded frozen native worker in
`context.json`. Read full CLI help and MCP tools, then called `output.capabilities`
through both transports. Imported an asymmetric PNG and one-second synthetic WAV,
created a 640×360, 30fps, opaque-black composition and placed independent image
and audio clips. The initial source PNG has orientation 6 and upright 40×64
geometry; no source capture or narration identity was invented.

Requested custom controls with **no preset field**: H.264 Main Level 3.1,
average 5,500,000 bits/s, maximum 15-frame / 0.5-second keyframe spacing, CABAC,
no frame reordering; AAC mono at 44,100 Hz and constant 96,000 bits/s. Polling
kept the exact project/revision/settings. The ready receipt returned a fully
resolved settings object alongside actual encoded profile/level and audio format.

Passed that returned object unchanged to another preview request and to durable
video export. Original preview, resolved-settings preview, and committed export
are all byte-identical (18,422 bytes; hashes retained). Retrying the exact original
export request, including its exportId, recovered the same committed intent.

Deliberately requested Baseline plus CABAC. Public preview refused it with
`INVALID_PARAMS`: “Baseline profile requires CAVLC and no frame reordering.”
No fallback settings or substituted media were returned. Request and raw error
receipt are retained as `12-invalid-combination.*`.

## Independent file verification

`ffprobe` of all three delivered files confirms H.264 Main, level 31 (3.1),
640×360, 30 video frames, and AAC LC, 44,100 Hz, one channel. The measured video
bitrate is 30,760 bits/s and measured audio bitrate 95,637 bits/s. This static,
one-second fixture is correctly far below its requested average video bitrate;
a requested target is not a guarantee of actual file bitrate. Encoded AAC has
46 packets/frames; that is distinct from the exact project’s one-second internal
48kHz stereo mixing result. This check does not judge natural-image quality,
frame-reordering quality, speech quality or audible resampling quality.

## Skill findings and attempt record

No blocking skill gap appeared in the requested custom-settings / resolved-reuse /
invalid-combination workflow. Its guidance to inspect capabilities, separate canvas
from encoding, read actual encoded results, preserve original retry requests, and
avoid substituting unsupported combinations was sufficient. This result does not
establish that every native encoder control is exposed, nor validate controls added
after this checkpoint.

All public requests succeeded except the deliberate incompatible-combination test.
Two local inspection/setup mistakes occurred before the respective public calls:
I initially indexed CLI help entries by `operation` instead of their actual `name`,
and a scratch MCP script imported its SDK from the repository root where that
package is not installed. Reading the actual help shape and running from the
existing test-harness dependency context resolved those tooling errors. Neither
was a public service refusal or required a product change.

Exact requests, commands, raw JSON receipts, stderr, discovery results, resolved
settings, delivered MP4s, independent probe results and hashes are in this folder.
The isolated service was stopped and its scratch home removed before handing the
worktree back for the control-expansion build. The three requested MP4 artifacts
remain outside the service home here.
