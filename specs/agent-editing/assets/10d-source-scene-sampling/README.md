# Selected-source scene sampling prerequisite

Selected video observations now use physical presentation membership through the
same explicit-stream decoder and oriented sRGB thumbnail owner as source pictures.
The native batch retains exact container sample start/end clocks and origin;
`actualSourceUs` is the existing half-away-from-zero microsecond conversion, not
an exact timestamp. Recording nearest-sample observations and their chunk codec
remain unchanged.

Unavailable observations distinguish an empty physical edit from a time outside
combined selected support. `outside_support` does not attribute the missing footage
to acquisition metadata; physical and optional acquisition support have already
been intersected. Touching support spans remain continuous. A gap between two available grid points also breaks continuity:
the sampler walks physical support between them rather than checking endpoints
alone. Decode errors remain errors. No black image stands in for unavailable media.
The core uses the existing pixel-change metric with a separate presentation policy.
It compares exact timestamps, resets comparison/stillness across gaps, and carries
only the exact overlapping endpoint and one pixel envelope between chunks. Stillness
starts on the observed request clock, so a held sample that began before a gap does
not claim continuous observation through the gap.

Each batch is bounded to 52 points over 10.2 seconds, with 64-pixel thumbnails,
100,000 physical support steps and 100,000 decoded samples. These last two ceilings
are provisional inspection budgets for slice 24. Exceeding one refuses explicitly;
it does not silently omit observations. Cancellation is checked before sampling,
within support traversal and within the shared decoder. The optional decoder limit
leaves movie and existing frame callers unchanged.

## Evidence

The actual native wire test uses two video tracks, a nonzero origin and a 50ms physical
empty edit between 200ms grid points. It verifies exact sample clocks, selected colors, half-open gaps,
sub-grid physical/acquisition holes, one-reader telemetry and malformed requests.
The existing source-frame native test and full frame executable pass, including
nearest selection, held frames, presentation evidence, bounded decode refusal and
cancellation. `native-tests.log` and `frame-preservation.log` retain these results.

`core-tests.log` records 496 passes and one existing skip; `focused-tests.log`
records 32 focused scene tests, including nine source-analysis tests after the
adjacent-span regression. Build, test type-check and focused lint pass. Removing the core gap
reset produced a false boundary; removing the native sub-grid check claimed
continuity across an empty edit. Both mutations failed their assertions and were
restored (`core-mutation.log`, `native-mutation.log`).

Independent review reproduced incorrect continuity after a non-grid chunk endpoint
and partially advanced state after a rejected batch. Both regressions failed before
the fixes. Source batches now repeat the exact previous endpoint, and analysis stages
its bounded state until the entire chunk succeeds. The recording grid is unchanged. A subsequent audit found that availability may
contain touching spans whereas recording retained spans may not. Native request
admission and continuity now preserve those legal joins; native/core regressions
failed before the fix.
The reviewer could not start AVAssetReader in its environment; the unrestricted
native results above are the executed native gate.

Selected-source pictures consume the same availability admission rule. Touching
support returns byte-identical PNGs and matching receipts to merged support; the
new assertion fails against frozen native `e9da7a3ad9fcea28d95f7bdfa7b61a7fec505a246e08f3f624d8f1e17cb8b1ec`.
Recording retained spans still require strict separation. A read-only audio probe
also reproduced touching-support refusal in its existing signed interval validator;
the [audio correction](../11a-touching-support/README.md) now verifies exact WAV preservation.

Follow-up independent reviews found the endpoint/state fixes, touching support
semantics and shared source-picture admission sound, with no further actionable
findings in those scopes. Native acceptance remains grounded in the unrestricted
runs retained here; review did not substitute sandbox failures for those results.

## Remaining boundary

This pass is sampler and analysis only. It does not admit asset chunks into the
existing recording chunk codec, publish source-scene jobs, create screenshot
indexes, expose scene queries or mark unsupported event coverage ready. The next
store pass must represent explicit unavailable grid entries and exact clocks, and
index scene boundaries by actual sample time rather than chunk request start.
Public CLI/MCP scene readiness, project projection and retained-index lifetimes
remain separate required gates. No new delivered-image visual acceptance is claimed.

[Combined integration](integration/README.md) preserves the live source-picture
journey and existing native frame behavior after this sampler lands.
