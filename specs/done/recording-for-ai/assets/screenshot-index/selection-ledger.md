# Incremental selection policy verification

The [selector](https://github.com/dzhng/screen-recorder/blob/9971437d1c1c6f0e31694ddd83212b851349eb81/packages/core/src/selection.ts) owns timing and selection;
the evidence adapter supplies ordered observations and existing measured changes.
[Bounded stillness](stillness-runs.md) defines what sampled equality permits.
Selection yields candidates in source order plus separate coverage rows referring
to emitted candidate ordinals. This avoids growing one image's coverage array
through an arbitrarily long still recording. Kept-span mapping comes from the
shared timeline plan; raw source and scene generations remain pinned in candidates.

The [focused tests](https://github.com/dzhng/screen-recorder/blob/9971437d1c1c6f0e31694ddd83212b851349eb81/packages/core/src/selection.test.ts) pin actual
ledger values for cuts, mandatory transition sides, cursor path distance, slow
motion, jitter, observed idle, acquisition gaps, continuous motion, duplicate
observations, clicks, geometry/eligibility resets, sparse future PTS and conservative
sampled equality. Cursor changes below the motion threshold still invalidate
static collapse. Identical known outside observations may prove absent-pointer
equality; unknown geometry cannot. Page boundaries do not change the ledger.

## Evidence

All sixteen selector tests and the full 171-test core suite pass. Build, type,
format and lint checks pass. The thirty-minute test consumes 27,000 observations
incrementally into two mandatory candidates and 360 coverage rows. Its first
output arrives before twenty observations are consumed, and every coverage row
references an already emitted candidate. This is pure selection evidence, not a
native decoding, foreground latency or visual usefulness claim.

A separate Node v24.14.0 built-module probe of that synthetic thirty-minute still
fixture reported 61,276,160 peak sampled RSS bytes and 17.2 ms elapsed on this host.
It sampled RSS at output boundaries; it is a single-run observation, not a general
memory or speed guarantee. Production state contains one event-time group, current
span/burst/equality state and a bounded pending-candidate window, not source arrays.

Independent Codex review found two defects. Late observed idle could emit a motion
endpoint after a later coverage candidate; output now waits behind the unresolved
endpoint. Reusing an earlier mandatory image for spacing could discard uncertainty
about a later pixel change; that uncertainty now survives until a fresh image is
selected. Both findings were reproduced by red tests before fixing them. No test
expectations were weakened. Follow-up independent review found no actionable
correctness defects; its additional boundary and randomized-stream probes retained
ordered candidates and valid coverage references. Parent contact sheets and real captured gestures remain
open until the retained public index is verified.

## Decision audit

**Sound, high confidence — distinguish an acquisition gap from idle.** If a circle
ends at second 4.9 and cursor acquisition stops, the selector can retain that
observed endpoint but cannot assert that the pointer stayed still afterward. The
reason therefore records an acquisition gap. When stillness is observed just before
the idle threshold, the selector waits for another observation or gap timeout before
emitting later images. Two consecutive 300 ms intervals bound this uncertainty;
the producer also rejects more than 5,000 pending candidates explicitly. This keeps
output ordered without inventing cursor points or dropping dense evidence.

**Sound, high confidence — retain uncertainty when spacing reuses an image.** A
pause image at second 4.8 may satisfy spacing for the five-second coverage request.
If pixels changed between those times, that old image cannot prove the later screen
unchanged. The selector keeps the interval unproven and retains a fresh ordinary
image at the next obligation. This can conservatively retain an extra image, but
never labels an outdated image as sampled-equivalent.

Internal record names and streaming state layout were delegated. The policy's
motion tolerances retain the specified initial values: fixture outcomes distinguish
subpixel jitter, slowly accumulating displacement and a returning circle. Their
physical usefulness still needs the parent contact-sheet/captured-gesture gates.
