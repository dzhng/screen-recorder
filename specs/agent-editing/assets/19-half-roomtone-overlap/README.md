# Room tone with250ms overlaps

**Rejected by the user.** The [user review](../listening-review-2026-09-30.md) describes
slight residual seams in the improved200ms treatment and the request for another
small attempt. The user reports a higher-frequency whirling sound in this250ms
version and chooses the previous200ms version. This comparison uses250ms overlaps between the same half-second region,
so two source occurrences play throughout the interior. The outer quarter-second
sections and10ms start/end fades remain explicit. No new source region is selected.

Listen to the [six-second monitoring copy](loop-monitor-plus24db.wav), with the
same +24dB output gain as the prior comparison. The [normal-level loop](loop.wav)
retains the unboosted treatment. Both are actual public CLI/MCP deliveries; source
samples, native worker and accepted voice/denoise outputs remain preserved.

The [fixed recipe](assemble.mjs) preserves the previous version as a separate
frozen evidence packet. It changes only overlap/spacing, occurrence count and
corresponding curve coordinates. Its250ms sine/cosine envelopes use25 admitted
linear keys per fade. The shared midpoint key is stored once. These weights have
an almost constant squared sum; correlated recorded sound can still change power
and texture. That mathematical property cannot establish perceived continuity.
No denoising, retiming, synthetic noise or automatic normalization is introduced.

[Measured execution](report.json) retains every admitted curve and the exact
source/worker/runtime identities. [Complete public exchanges](exchanges.json.gz)
retain all four audio deliveries, including the transient dry-source and undo
WAVs. Those equal the existing [source](../19-clean-roomtone/source-region-stereo.wav)
and normal loop respectively, so redundant copies are omitted here.
[Independent root reconstruction](root-verification.json) compares all288000 stereo
frames, verifies two active sources throughout the interior, and rejects a wrong
linear-overlap oracle. Explicit monitoring gain remains finite and unclipped;
undo restores the complete normal WAV. The later hearing rejection supersedes the assembly-time pending disposition;
it does not change any measured result.

Reproduce in a new directory using existing built JavaScript and the pinned worker:

```sh
SCREENREC_NATIVE=/tmp/screenrec-03d-native-build/debug/screenrec-native node specs/agent-editing/assets/19-half-roomtone-overlap/assemble.mjs --out /tmp/roomtone-half-fresh
```

[Audited choices](../../choices.md#room-tone-overlap-refinement-2026-09-30) explain the
finite comparison. No new production API, dependency or ambience policy is added.
