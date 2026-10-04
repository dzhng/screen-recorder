# Presenter and screen effects proposal

Status: early proposal. These visual references express user intent, not an
implementation-ready plan or a claim of current support. When activated, compare
current [composition](../../packages/composition/README.md), capture and processing
capabilities with the desired result, then plan only the missing primitives.

## Independent sources and monitoring

The caller chooses recorded inputs, layout, timing and treatment under the
[product boundary](../../README.md#product-boundary). Live camera monitoring is
separate from recording authorization and export layout. Recorder-owned preview
windows must stay outside screen pixels; changing monitor position cannot alter
the retained source or silently end a requested recording.

Source media and exact clock mappings remain independent. Capture cannot choose
a multi-video composition, and a monitoring rectangle cannot become an implicit
camera placement in the output. Existing layout, pointer and text primitives stay
owned by the shared composition and compiler.

## Visual authority

The [asset manifest](assets/manifest.json) owns the supplied screenshots' identities.
They are the available authority from the [linked example](https://x.com/pie6k/status/2105747150088937965?s=20).
Player borders and controls are reference framing; sample text is content rather
than an instruction or required wording.

![Framed screen, rounded camera inset, large pointer and caption](assets/screen-warp-camera-inset.png)

This reference calls for independently controlled screen distortion, presenter,
pointer and text layers. It does not select an effect algorithm or processing order.

![Enlarged presenter silhouette over the screen](assets/presenter-cutout.png)

The presenter overlaps the screen with their camera background absent. The
[segmentation proposal](../video-segmentation/README.md) owns generalized mask
questions; this still cannot establish hair-edge or moving matte quality.

![Screen detail with camera inset, enlarged pointer and caption](assets/screen-detail-camera-inset.png)

The different layouts imply independently authored placement. They do not specify
transition duration, easing, motion path or speech-driven timing.

## Questions before implementation

Determine what already executes through the public API, what new monitoring or
pixel-processing primitive is needed, and whether supplied alpha or prepared
segmentation is required. Declare coordinate mapping and order so pointer overlays
cannot accidentally be cropped, warped twice or duplicated with a baked-in cursor.

Motion, device-loss behavior, prepared-model choice and quality/performance targets
remain explicit decisions. Preview, range inspection and export must evaluate the
same composition phase; no second effects timeline or automatic presenter preset
is implied. A model candidate must earn its local feasibility and edge-quality
claims before becoming a dependency.

## Evidence

Reuse retained recordings and existing source/clock proof. Compare references at
the intended region; moving transitions and mattes need temporal observations,
not only a similar still. [Verification tools](../../packages/test-harness/README.md)
separate appearance, source preservation, synchronization and cost. Missing
perceptual evidence does not request another user recording when existing inputs
can answer the technical question.
