# Reference editing style audit

The user supplied [Jamey Gannon’s video](https://x.com/jameygannon/status/2104652754337882395?s=20)
on 2026-09-28 and asked whether the completed editor can reproduce its techniques.
A separate agent scrubbed the actual approximately 71-second video in the browser
at roughly 2, 8, 15, 19, 26, 32, 37, 43, 48, 55, 60 and 67 seconds. This is a
visual reference audit, not a rendered acceptance test. The browser tab was closed.

| Observed technique | Planned owner and remaining qualification |
| --- | --- |
| Short white captions with dark edges | [17](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/17-text-captions.md); exact stroke/shadow styling is not explicit in the current contract and needs reconciliation before claiming a match. Word highlighting was not verified. |
| Stacked windows, cake image around 14.5s, photo grid around 19s, app footage later | [15](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/15-layer-geometry.md) layers and [16](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/16-keyframes.md) animation. |
| Presenter framing changes and punch-ins | Geometry/keyframes; sampled stills do not distinguish every deliberate transform from natural body movement. |
| Graphics behind hair, head and shoulders around 19s and 60–67s | Requires foreground masking. Current slice 15 explicitly refuses unsupported masks; no automatic person-cutout owner exists. The visible result does not establish the creator’s exact method. |

Popping sounds and replaced narration are user-described. The reviewer could not
audition the soundtrack; visual inspection cannot identify synthesized audio.
Timed imported sound effects/music and independent audio replacement are within
the plan. A built-in sound-effect library or generator is not promised.

The user explicitly chose **Keep the current scope** on 2026-09-28. Automatic
person cutouts remain outside this run; ordinary rectangular layers are included.
Do not claim that the completed editor recreates the behind-the-presenter effect
from ordinary footage. Exact caption edge styling remains a verification detail
for the existing text/caption slice, not an accepted masking expansion.

The user subsequently requested a future [generalized video segmentation processor](../../../../video-segmentation/README.md), with SAM 3 as an example candidate.
This supersedes the person-only framing of the proposed extension; it does not
activate implementation in this run.
