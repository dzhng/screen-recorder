# 15a1 — Frozen learned native-entry parity

Status: native byte parity and refusal/cleanup gates pass; final review evidence is retained in the [checkpoint](../assets/15a1-denoise-entry/README.md). Parent: [15a](./15a-noise-processing.md). Dependencies: frozen [12c](./12c-noise-reproduction.md) recipe and retained PCM, not its unresolved listening verdict.

## Contract and seam

The production-intended native RNNoise library preserves the pinned mono recipe byte-for-byte on matched retained inputs. One state covers the entire explicitly selected input, regardless of caller chunk size. Normalize float by 32768 around the unchanged 480-frame API; pad the final partial frame with zeros, flush two frames, remove 960 output samples and return exactly the selected count. Keep source/model/build identities and old failed controls. No algorithm change, model conversion, strength knob or new channel/reset policy.

A separate SwiftPM native dependency package keeps this preparation prerequisite outside ordinary app builds. Vendor only unchanged small sources/headers and license. Explicit local preparation validates both the frozen archive and extracted generated model hashes; no implicit network or runtime staging. The 78 MB generated model source stays ignored. A typed native parity executable consumes the same library future audio execution will call. This adds no renderer, timeline, storage or queue. Runtime integration later adds the library directly to the existing audio owner; model preparation/distribution and public readiness are not established here.

## Verification

Use retained original/clean/noisy PCM and original tiny/end controls, compare complete compensated bytes against the frozen output. Check exact sample counts, first/interior/end placement, arbitrary input chunks, format/nonfinite refusal and cancellation/error cleanup. Keep no-flush, one-frame compensation, poisoned-selection and split-reset negatives discriminatory. No new quality sweep or tolerance. Preserve actual compile duration, executable identity, requests and outputs with independent code review. A parity failure must be localized, not repinned.

The readable artifact is a reproducible command/report and exact PCM; no new visual or listening claim. Public processor discovery and product worker behavior stay unavailable/unchanged. Root updates the main plan checklist. Remaining work belongs to [15a2](./15a2-denoise-prepared-consumers.md) and [15a3](./15a3-denoise-acceptance.md), with the complete parent requirements intact.
