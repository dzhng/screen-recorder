# Recovery review disposition

The [independent review](independent-review.md) was static: its restricted Bash
allowlist prevented runtime probes. Root treats suggestions as hypotheses to verify.

| Finding | Disposition |
| --- | --- |
| H1 missing video tail/cursor silently yields empty success | Accepted; Opus correction in progress. Retain proved prefix and explicit failure, never guess tail duration. |
| H2 cursor uses wrong time domain | Accepted; cursor/asset mapping independently observed in native frame work. Correct exact last-sample mapping and test variable durations. |
| H3 incomplete journal should expose unproven decoded audio as acquired | Rejected as proposed: decoder padding can masquerade as narration. Known journal prefix remains valid proof even with a torn tail; retain source bytes for later inspection. Improve absence/failure descriptions without promoting unproven speech. |
| M1 no actual fragmentation evidence | Review snapshot lacked integrated reports. Own-window SIGKILL reports and eight generated PCM cases now retained; root reran all PCM recoveries against integrated worker. Reusable kill harness remains open. |
| M2 full decode blocks worker | Full decode is required to prove decodability. Removing it or capping advertised evidence would weaken recovery. Service jobs must own worker cancellation and isolation; full slice remains open. |
| M3 invalid middle record versus torn tail | Accepted for explicit journal failure description; correction in progress. Never resume past an untrusted sequence gap. |
| M4 per-buffer logging/fsync may drop samples | Not measured as a regression. Keep acquisition proof; actual two-track performance gate remains open. No speculative queue/coalescing rewrite. |
| M5 missing unrequested tracks look failed | Accepted; use known header intent while preserving unknown intent without a header. |
| L1 video position in fixed role array | Internal fixed ordering is explicit and local; no defect alone. Revisit naturally if filtering changes it. |
| L2 malformed clock event silently nil | Accepted, with writer/reader roundtrip test. |
| L3 journal data not in compact summary | Intentional: full acquisition file is retained for service ingestion, summary avoids copying all events onto the wire. |
| L4 repeated source filenames | Small shared naming cleanup may accompany recovery correction; no separate registry framework. |
| L5 acquiredAudio omitted by CodingKeys | Intentional response-size bound. Internal proof is not duplicated into the wire summary; returned intervals already reflect it. |
| L6 hand-built fixtures only | Add real journal roundtrip coverage; generated PCM already uses the actual journal writer. |
| L7 try! response serialization | Current values are JSON-safe; no demonstrated trap. Keep boundary failure handling explicit as the operation surface grows. |
| L8 wire depends on native execution | Intentional worker boundary, not a portable transport-only package. Three operations do not justify a dispatch framework or parallel types target. |
| L9 ffmpeg hard fixture dependency | Documented development dependency. A missing tool must fail with an actionable message, never silently skip a required gate. |
| L10 stale spec | Corrected in integration; full slice remains unticked because product gates are genuinely open. |

Corrections run in `/tmp/screenrec-recovery-fixes`, branch `fix/native-recovery-review`.
Do not mark these accepted fixes complete until integrated and rerun.
