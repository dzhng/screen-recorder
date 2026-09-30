# Exact recipe admission without PCM

The Swift and C metadata entry points validate the same count/channel domain as
execution. Both consume one frozen configuration and the same upstream short-input
predicate after guarding its float-to-int conversion. This avoids a second duration
policy in TypeScript. Identity remains a direct bypass, including tiny selections.

The standalone admission check covers accepted counts, neighboring input counts at
the truncated seek boundary, invalid/overflow counts, format refusal and identity
at the integer capacity. Forcing every positive count to pass makes this check fail;
[the mutation record](mutation.json) retains that result. Restored checks and all34
mono/23 stereo regressions pass, including complete frozen output hashes.
[Verification](verification.json) pins the changed owners and binary/report identities.

Validation configures fixed-size engine state but processes no samples or files.
An exploratory1000-configuration stereo loop took128ms on this host; no global
cache was added. This is one setup measurement, not a universal metadata deadline.
Unsupported calls now avoid upstream's zero-fill side effect; failed output already
belongs to the caller and must be discarded. No successful PCM behavior changes.

Independent code review found no blocking issue. The native caller must resolve
physical source segments and actual run counts before using this API. Admission
does not prove source finiteness, file availability or perceptual quality; public
capability and job admission are separate14e integration work.
