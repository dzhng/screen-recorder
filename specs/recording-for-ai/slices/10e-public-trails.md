# Default trail frames through the public inspector

Status: core and public integration pass generated-media tests and independent
static-image review. Real captured gesture/geometry and broader vertical cases
remain open. Clean single frames and batches retain their existing behavior. This pass makes their normal mode satisfy the
product's pointing contract; it does not add a separate inspection API.

## Ownership and dependency

The existing frame inspector pins the revision and maps playback time once.
Annotated work also pins the published source-evidence generation. If source
processing is pending or failed, expose that dependency and its retryability;
a frame retry must not secretly retry its source dependency.

Keep one frame job and the existing two-worker limit. Within that job, the shared
trail planner obtains bounded clean observations and indexed cursor/pause/geometry
evidence, then native draws the supplied overlay. Native owns coordinate conversion
at acquisition and rasterization at delivery; core owns eligibility and resets.
The final native frame selection must agree with the image used by the planner.

Cache identity includes every effective rendering option and the evidence/policy
identity used for annotation. Clean frames need no source-processing dependency.
Source media, raw evidence, revisions and selected index evidence remain immutable
and outside the disposable image cache.

## Public behavior

Normal requests show the observed pointer and preceding two-second trail.
clean:true disables both; trailUs:0 shows only eligible pointer evidence; custom
duration keeps the established ten-second cap. Do not introduce a success path that
quietly returns clean pixels when required evidence or analysis failed.

A known reset can leave no eligible points. Distinguish that legitimate empty
overlay from missing evidence: return its reason and timing, alongside requested
and actual video time, pointer observation time, effective trail interval and
source/policy provenance. Future-image compatibility must follow the
[requested-time rule](10c-trail-timing.md); a future image never authorizes future
cursor samples. Global window movement can reset a path while preserving compatible
output pixels; an incompatible resize must not inherit old coordinates.

The registry, service, CLI and MCP share these options and metadata. Ordered frame
batches preserve each item's readiness/error and actual image bytes. No adapter
chooses a different trail mode, clock, geometry transform or retry policy.

## Vertical acceptance

- Generated media with normalized evidence exercises held circle/wave, future
  matching/changed images, cut, pause, moved window, resize, outside/unknown cursor,
  duplicate timestamps, missing geometry and explicit processing failure.
- Verify requested/current/historical revisions, source generation, cache replay
  and eviction regeneration. Keep the existing clean frame/audio and batch gates
  green after default options change.
- Compare clean, pointer-only, default and custom modes from the same selected
  source frame. Confirm actual production pixels differ where expected and remain
  unchanged outside annotation. Inspect target text and path readability.
- CLI files and MCP images match. Fresh non-Claude visual critique reviews the
  delivered result; SDK receipt alone is not model-level interpretation.
- Real captured circle/wave and physical moved/resized-window geometry remain
  their original acceptance gates. Generated observations prove planning and
  rendering mechanics, not those acquisition outcomes.

Persist shared scene observations/boundaries and provenance for global screenshot
selection without creating another detector. Parent slice10 stays open until its
real gesture and readability gates are met.


## Core inspector checkpoint

The [core evidence](../assets/trail-evidence/frame-inspection.md) verifies default
annotation, clean bypass, explicit source/native retry behavior, ordered batches,
pinned revision/source generation, eviction and cancellation. Source demand is
admitted after the complete batch validates, through idempotent source preparation.
It does not wait behind all unadmitted background history or retry a failed source.

Annotation metadata is projected once in core: effective/actual intervals, cutoff
reasons, observed pointer, geometry epochs, counts, policies and bounded visual
coverage/metrics. Raw RGB observations and full rendering-point arrays stay out of
public metadata. Source integrity is retained without copying its full receipt.
Native receipt validation permits Swift's omitted nil timestamps but requires an
overlay receipt even when there were no eligible points to draw.

## Public integration checkpoint

[Delivered evidence](../assets/public-trails/review.md) covers the real bundled
service, native rendering, CLI files and MCP images. Default, clean, pointer-only
and short trails use the same frame route; requested-time history survives a held
image and a compatible future image, while pause and changed-scene resets remove
ineligible history. The current generated public fixture does not yet cover every
geometry/edit/failure case above; core coverage is not relabeled as public proof.
