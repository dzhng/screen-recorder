# 14c3c2 — Arbitrary package frame and audio inspection

Status: frames are implemented in [14c3c2a](14c3c2a-package-frames.md);
audio is implemented in [14c3c2b](14c3c2b-package-audio.md). Depends on the public retained-index boundary in
[14c3c1](14c3c1-public-package-index.md).

The existing frame/audio operations gain the same mutually exclusive package
selector. Default revision remains the exported pin; explicit historical requests
must use retained validated history. No parallel `package.frame`/`package.audio`
API, shadow recording rows, extraction engine or scheduler.

Factor production inspection orchestration around its actual context/output
owners before wiring adapters. Preserve the shared frame/trail materializer,
source timing/audio planner, FileAccess evidence readers and descriptor-backed
native media inputs. Heavy package work belongs to the existing queue-issued
context; repeat requests and failures must keep making progress through its
bounded terminal metadata and reusable output leases. Close still fences requests,
drains native/read work, revokes only this handle's deliveries, then cleans storage.

Verification uses a generated no-narration ZIP after relocation. Compare arbitrary
clean/annotated frames and acquired-system-audio excerpts through the actual
CLI/MCP route against library inspection, including a timestamp outside the retained
index, cuts, pauses and historical revision selection. Exercise repeat requests,
explicit retries, held output reads, close during actual native work, same-content
open isolation and same-ID library deletion. Source bytes stay unchanged and every
owned worker is reaped. A narrated-package readiness claim still requires the
accepted transcript payload owner; this pass cannot manufacture it.
