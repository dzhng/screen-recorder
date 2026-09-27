---
name: renderer
description: Architecture rules for GPU rendering with TypeGPU/WebGPU — games, data visualisation, canvases, any app that draws with the GPU. Use when adding or changing passes, shaders, buffers, textures, pipelines, frame orchestration, GPU resource lifetimes, or checks that judge rendered output.
---

# GPU renderer

The stack is **TypeGPU on WebGPU**: typed schemas, bind group layouts and pipelines, with WGSL where it's clearer. Don't add a second rendering library.

## Architecture

- **The renderer draws what it's handed.** The app builds plain frame inputs from its own state (a game observation, a query result, a document), and the renderer consumes them through one interface. It never reaches into app or domain state.
- **One frame function orchestrates.** A single function encodes every pass in order. Read it before adding anything, and add your pass there, not beside it.
- **Pick the phase by semantics:**
  - compute for preparation (culling, layout, instance building);
  - a depth prepass for opaque geometry, then the lit colour pass;
  - translucent content after the opaque;
  - screen-space passes on resolved targets;
  - overlays and UI last.
- **One owner per concept:** device and capabilities, camera and projection, the depth convention, frame targets, the resource registry, the time source. A second copy (a private projection, or a struct hand-mirrored in WGSL) is a bug waiting to happen. Refactor to the shared owner.
- **Tunable numbers live in data** (config or fixtures), validated where they're loaded. Don't scatter them as constants in passes.
- **Update each resource at its own frequency:** every frame, on view change, on data change (upload deltas only), or once. Allocate nothing per frame on hot paths.
- **Do CPU-side math with the pmndrs [`math`](https://github.com/pmndrs/math) package** (npm `math`, whose `API.md` lists every export): vectors, matrices, quaternions, frustum and shape culling, noise, seeded randomness.
  - Its functions take the output as their first argument and return it, so preallocated scratch keeps hot paths allocation-free.
  - Pack its results into preallocated `Float32Array`s for upload.
  - Don't hand-roll a second vector or matrix library.
- **Picking and hit tests use the app's own shapes** and the same camera function the GPU packing uses, never a readback of drawn pixels.

## Resources

- **Every buffer and texture goes through one registry,** with scopes for size-dependent targets and slots for replaceable resources. Nothing is allocated outside it: in TypeGPU, `root.destroy()` does not free what the root created.
- **Handle async rebuilds** (resize, pipeline swaps). Build into a new scope and swap it in whole. Free a build that's overtaken or finishes after dispose. Make every public call safe after `dispose`.
- **Add a test that counts and bytes return to baseline** after resize, rebuild and repeated reset.

## Depth, blending and targets

- **Depth is an access contract** (`read`, `read-write`, `prepassed`), and the convention is engine-wide. Prefer reverse-Z on `depth32float` (clear 0, compare `greater`). Compare direction, clear value and format change together or not at all.
- **Opaque geometry never alpha-blends.** Translucent passes read depth and never write it.
- **Overlays and UI are composited after post-processing,** unlit and ungraded. Anything that belongs in the world is drawn in the world.
- **The depth prepass and the colour pass share one vertex stage** with an `@invariant` position, so their depth matches bit for bit.
- **Use 4× MSAA** (the count WebGPU guarantees). Interpolate at the centroid any varying that a later screen-space test depends on.

## TypeGPU and WebGPU gotchas

- **Pin only the shared camera bind group** (`$idx(0)`). TypeGPU numbers the rest.
- **A pipeline with no fragment stage is valid.** Use it for depth-only passes rather than writing `frag_depth`, which disables early-Z.
- **WGSL `let` is immutable.** Reassigning one invalidates the pipeline while the app looks healthy.
- **Pad uniform structs to 16 B.** Keep a byte-size constant beside each schema and test the packer against it.
- **Default bind limits are small** (8 storage buffers per stage). Count before adding one.
- **Apple GPUs:**
  - A tile a pass drew nothing into skips its resolve, so a loaded target can show an old frame there. Make the background pass resolve too.
  - Timestamp queries are only meaningful as a whole-frame total.
- **Keep matrices float32 on the CPU as well,** so CPU picking and GPU drawing agree exactly.
- **Treat any validation warning or console error as a failed render.**

## Verification

- **Use one injectable clock** for animation. Never use `performance.now()`, `Date` or unseeded randomness inside a pass. A held clock gives deterministic captures.
- **Test packing and CPU mirrors of shader math in unit tests.** Then render the narrowest real scene in a browser running on the real GPU (not a software fallback), and look at the image.
- **Stats aren't pixels.** Pair counts with a pixel or crop check that proves the subject was drawn and framed.
- **Derive checks from contracts,** not copied constants. Change a pixel threshold only with a written reason.
- **Measure GPU cost with the feature toggled on and off, interleaved on one machine,** not as two separate runs. Other load on the machine swamps small differences.
