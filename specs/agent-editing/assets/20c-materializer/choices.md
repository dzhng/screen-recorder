# Reviewed decisions

## Sound, provisional scope

- **Measured working capacity is not product completion.** The current owner can represent 100k exact runs, but a full run exceeds existing service deadlines and smaller downstream selection limits. Keep normal capture rollout closed until publication/deadline and admission projection gates are integrated. Do not silently rename an experimental bound as the recording contract.
- **Bound each platform reader start.** When a highly fragmented take is verified, temporary dense compositions contain at most 1,024 runs. The complete sample digest continues across those batches; no samples are skipped and no total duration is shortened. This trades some repeated setup for explicit cancellation points. The batch size is an implementation working set, not a user limit or latency promise.
- **Reject unrepresentable phase before future acceptance.** Native sample rate and the fixed admitted phase together determine the required container timescale. Some unusual combinations do not fit CoreMedia. Refuse them explicitly, retain existing evidence, and apply the same check before future writer acceptance rather than discovering impossibility after recording.

## Sound

- **Separate readable prefix from safe deletion.** A damaged take can yield a useful exact prefix without proving that its full working payload is disposable. Return accepted/committed/represented counts and indexed EOF separately. Publication may use the prefix; cleanup needs equality of all counts and clean indexed EOF. No forensic parser is invented to interpret arbitrary unindexed bytes.
- **One verifier for creation and restart.** Existing candidates are checked instead of overwritten. After healthy cleanup, canonical media is checked from the same pinned journal prefix and the same sample/support verifier, with receipt parsing left to publication. This avoids two definitions of ready media.
- **Hash bytes and placement independently.** PCM identity excludes placement, while support identity includes fixed phase and normalized exact run addresses. Both have explicit domain/version and byte encoding. Callback segmentation therefore cannot change the identity of the same represented audio.
- **Explicit whole-file descriptor access.** Ordinary inspection retains its 64MiB budget. The complete canonical verifier opts into streaming through the same pinned descriptor owner; chunk and concurrent-request bounds remain. It never falls back to a mutable source pathname after admission.
- **Promote only the actual shared native semantics.** Exact rational time and the native-address reader serve existing Audio consumers and canonical verification in Media. Rate conversion stays with Audio, and no generic DSP or recovery framework is added.
