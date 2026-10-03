# Retained candidate reader diagnostic

One bounded read of the existing failed recovery candidate completed without
re-export, mutation or publication. Its unbounded AVAssetReader and the unchanged
SampleTiming support helper delivered 7,407 buffers, of which 4,445 had occupied
support, then reported completed. The candidate remained byte-identical:
1,908,080,623 bytes, SHA256
`58eb6ab319a5c3e01e242041bc1a3eeed19670ae7cce52740f1f2af6b8f1bf04`.

This does not explain or fix the original blocked recovery. Both original process
samples point inside the represented-frame loop at ProbeCameraMedia.swift:233;
the blocked ordinal is unknown. The standalone diagnostic holds no preceding raw
decoder, performs no pixel digest or export, and starts with an already-closed
candidate. Unbounded reading alone did not reproduce the hang. Its 24.013-second
wall observation and 121,978,880-byte sampled RSS are diagnostic, not acceptance
budgets; concurrent fixture Git packing was possible host load. The external
60-second/4-GiB operational guards were not reached.

Comparing every occupied decoded timestamp to the actual accepted journal reveals
a separate failure. The first 3,181 points match; at zero-based ordinal 3,181 the
candidate presents 181,210,793 us, while the next accepted mapping starts at
181,244,263 us. The previous point matches at 181,177,603 us. Thus the occupied
candidate output is not an exact mapped prefix, and the total 4,445 cannot be
claimed as a valid represented prefix. The journal has 4,502 accepted rows. The
existing publication equality check remains necessary; no output was admitted or
threshold relaxed.

`evidence.tar.gz` retains the standalone diagnostic source, exact shared timing
source, build log, complete before/after read trace (ordinal, PTS, status),
watchdog receipt, candidate pre/post identity and journal comparison. The large
immutable candidate remains at the path in the receipt; originals and the
[original blocked recovery samples](../../20-physical-import/README.md) remain
separately preserved. The next useful check must distinguish candidate
support/timestamp generation from decoder resource lifetime. No finite-range fix
or further experiment is claimed by this checkpoint.
