# Saved-take writer and reader controls — recovery still open

Direct original-track insertion into AVMutableMovie passed the tiny local splice:
all three exact picture timestamps, coded payloads, BGRA hashes and occupied
ranges match. The matched segmented-composition paths failed earlier. This is a
local result, not full recovery acceptance.

The full per-run-copy attempt made a 4,611,851,009-byte candidate from the
424,848,170-byte raw input and failed with “Cannot Open” before candidate reads.
Its extended-size mdat header declares 4,296,293,199 bytes; a complete moov/co64
exists later, leaving 314,509,650 bytes between declared mdat end and moov. The
parser handles 64-bit box lengths. This is malformed container evidence, not a
claim that MOV lacks large-file support or that a particular SDK internal cause
is established. The exact throw boundary remains header writing/subsequent open.

Copying the verified prefix once and replacing excluded gaps with equal-duration
empty ranges passes the same tiny exact control and avoids the observed copying
amplification. On the real take its header returns and candidate opens, but full
verification blocks inside copyNextSampleBuffer. The source contains 4,428
physically readable pictures matching the first 4,428 of 4,502 accepted journal
rows. All journal rows remain retained and structurally validated; 74 are beyond
the physical prefix. They must not become invented pictures. The complete raw
picture digest is `66f1c50c6ba4536b3c1c5caccb5c1d213b0bb802b115777eb18da61f5260d86a`.
The candidate has not earned that complete comparison.

| Control on the same saved candidate | Result |
| --- | --- |
| Full owner, raw reader/movie retained | 180 s operational stop at candidate 222 |
| Raw reader canceled/released first | 90 s stop at candidate 2368 |
| Pool around copyNextSampleBuffer only | 90 s stop at candidate 3265 |
| Pool around whole sample/support/digest iteration | 90 s stop at candidate 222 |
| Candidate occupied-range filter without per-sample cursor | 90 s stop at candidate 3265 |
| Finite first-to-last occupied reader span | 90 s stop at candidate 164 |
| SDK random access, five-picture neighborhood around first stalled gap | 20 s stop after two candidate pictures |

These are diagnostic stop guards, not product performance limits or passing
latency observations. Every process terminated; none of the timeout results
proves completion. SIGTERM can yield exit zero from AppKit, so `stoppedBy` remains
a failure irrespective of that process exit code. No timeout was widened.

The random-access control follows the SDK sequence: enable before start, drain
initial zero-duration pass to NULL, reset to ordered nonoverlapping actual occupied
ranges, then mark configuration final. The zero pass produced one black buffer;
an earlier assumption that its first read must be NULL was a setup assertion
failure and is retained separately. The corrected five-picture test confirms the
source oracle first and still stalls on candidate decoding. No full random-access
run was attempted afterward.

No pool, cursor, finite-range or alternate-reader policy has been adopted. The
single-copy writer remains an uncommitted draft awaiting proof. Exact PTS, support,
complete pixels and atomic publication guards are unchanged. Even a future
verification-reader success must also prove ordinary public source/render consumer
usability; a special verifier cannot hide an unusable canonical artifact.

The archive contains scripts, bounded traces, failed reports, local MOV controls,
metadata and source snapshots. Large immutable inputs and failed candidates stay
at the hash-pinned paths in `external-media.json`; original fixture media is owned
by the root's retained Git LFS fixture. No original changed or new capture occurred.
Fresh read-only architecture review found the small SDK replacement proportionate;
it did not establish decoder correctness. Do not repeat the exhausted controls
without a new causal finding.
