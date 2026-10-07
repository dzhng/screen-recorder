# Speaker continuity replication — partial verdict

The recovered runtime preserves the original30s speaker operation exactly. The
unchanged native streaming recipe passes independently labeled3speaker controls
through600s, including280s absence/re-entry and120s known silence. The4speaker
overlap gate fails. Slice31 is not complete and public32 labeling is not cleared.

## Contracts and ownership

Existing Core Models prepared the checkpoint and clone-only runtime. Existing
service jsonWorker owns every inference process/deadline; networking, original
interpreter/dependency donors and repository reads are denied during inference.
The lab uses a hash-bound scratch worker outside the prepared original execution
closure. It is research, not a new registered production runtime.

The frozen high-context recipe remains chunk340/right40/FIFO40/update300/cache188,
CPU2threads, native80ms rows, native onset/offset0.5 with zero duration/padding.
One native diarize call initializes state once and preserves it across27.2s
internal chunks. Another call resets state. Anonymous slot IDs never identify a
person or support cross-call association by number.

Raw segment lines, all Float32 probabilities and lossless native tensor bytes
are retained. No threshold, clipping, score rewrite, rounding or quality gate
adjustment made a failure pass. Frozen original computational and streaming
source files compare exactly.

## Results

| Case | DER | identity confusion | overlap recall | inference | verdict |
| --- | --- | --- | --- | --- | --- |
| Original matched bspxd30s | exact15semantic fields | unchanged | unchanged |0.472s | preserved |
|24s assembled same-voice return |1.0417% |0.6667% | none |0.266s | pass |
|100s three voices, returns/silence/overlap |2.0208% |0% |98.875% |1.308s | pass |
|336.32s untouched bspxd |3.7020% |0.0105% |88.2135% |4.982s | pass |
|600s repeated three-voice bspxd |4.8810% |0.1340% |88.4211% |9.029s | pass |
|600s third voice returns280s later |2.1154% |0% | none |11.240s | pass |
|600s repeated four-voice aiqwk |20.0017% |2.4723% |0.5381% |7.902s | **fail** |

All continuity cases use pre-frozen DER<=20%, global identity confusion<=5%,
overlap recall>=80% where overlap exists, inference<=2x audio, RSS<=4GiB.
The long-absence case independently required>=95% post-return attribution and
<=0.24speaker-seconds inside120s silence: observed100% and0.12s. Maximum valid
continuity RSS was2,931,113,984bytes. A planted slot swap after5min fails the
unchanged global timeline scorer; remapping every window would conceal it.

The four-speaker failure is genuine. A cheap original aiqwk30s replay retains
14.9238% DER but only0.24/2.23s overlap(10.7623% recall). Its historical DER-only
pass never proved overlap detection. In the600s case all four slots remain
globally associated, but simultaneous speakers are largely missed. Unknown
assignment must not conceal that required recall failure.

Real project observations executed100s mixed800–900 and60s each of Graham800–860,
Madison1840–1900 and Lily800–860. Native Float32 source extraction and the pinned
FFmpeg mono16k conversion are hash-bound; parent-verified original byte identities
were reused with unchanged size/inode/mtime admission. Mixed audio yielded3slots;
each raw take yielded1slot. These are descriptive observations, not independently
labeled speaker truth, lexical attribution, raw-to-raw alignment or quality passes.

## Runtime recovery

Prepared original runtime digest:
`b4e03d54e631fc5b15dbcd772508940f58ce7aeb2b1e4695427e0332644d2b5c`.
It differs from historical6d21… because the dependency closure was reconstructed.
Primary computational sources and streaming sources match, relocated imports pass,
and the matched original15-field inference comparison passes exactly.56,661files,
1,415,633,913logical bytes.54thin native operands had declared foreign RPATHs
removed and clones re-signed through the existing assembler/native policy;21fat
binaries remained unchanged. Final pip check reports no broken requirements.

Checkpoint SHA256:
`8abd32832159c6ac1148c926b7276f35ba34582c444e559dce1f1253fea42ef8`.
Prepared runtime/model paths are in evidence/prepared-runtime.json. Default public
speaker registration still pins the historical runtime; this private preparation
does not change that registration. Do not claim default speaker readiness yet.

## Limits and next work

- Preserve original30s/four-slot regression separately from the new continuity
  profile. Resolve the mandatory four-speaker overlap gap with an honest provider
  or explicit reslice; never silently downgrade the gate to close31.
- A3speaker partial profile is useful evidence, not permission to declare general
  labeling complete. No automatic count>4 detector has been proved. Four native
  active slots can signal that a3speaker envelope was exceeded, but hidden extra
  speakers may still be missed.
- Existing state/cache is bounded; selected PCM, features and total scores are
  materialized.600s evidence is not arbitrary-duration bounded-memory proof.
  Caller pagination/replay must read one retained execution, not redo diarization.
- Score sigmoids are uncalibrated. Retain overlapping/unknown observations. Words
  crossing speaker boundaries/overlap need a separate deterministic attribution
  contract; this lab has not verified public word attribution.
- VoxConverse training overlap and dataset rights restrictions remain. Source WAVs,
  raw movies, checkpoints and runtime binaries are scratch inputs, never Git
  fixtures. New controls are independent source-RTTM assemblies, not population QA.
- The first long-absence assembly accidentally overwrote a simultaneous placement;
  it was disqualified before scoring. Its invalid-control receipt and failed
  placement admission remain. Corrected v2 froze non-overlapping placement and
  exact source-sample admission before inference; no model/gate changed.
- Initial dependency sdist preparation wrote pip's default user cache; subsequent
  preparation used owned scratch caches. Installed app and managed library were
  untouched. No process remains running after these completed invocations.

All complete operands and attempt receipts remain under this scratch root. Compact
handoff-evidence preserves reports, protocols, raw outputs and acquisition/runtime
receipts without copying media. Root owns integration, spec reconciliation and
public production implementation.
