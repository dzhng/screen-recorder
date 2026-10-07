# Native asynchronous cache path

Verdict: null on the selected single-stream controls. Complete Float32 scores and
interpreted turns exactly match the synchronous parent across short multi-voice
inputs and repeated return/silence/cache updates. This path does not supply a new
quality result or admit long-form labeling. The preregistered null rule skips
another unchanged ten-minute inference.

The [protocol](protocol.json) freezes one native state/update implementation change,
with the same model, buffering recipe, interpretation and mandatory gates. The
pinned source already uses a persistent streaming cache in the parent call;
switching to the owner-documented asynchronous path changes representation and
ragged-row handling, not speaker identity semantics. The [worker](worker.py) is a
frozen research snapshot, never a product provider or runtime fallback.

[Results](results.json) preserve matched scores, complete raw-byte/turn parity and
resource observations. [Operands](operands.json) bind every original observation
and receipt in the compressed [observation bundle](observations). Source media,
weights and prepared runtime are shared immutable inputs, not included artifacts.
Three network-denied calls ran without retries or acquisition. Their inference
costs remain separate from cold load; resource differences do not establish a
speedup from this unreplicated comparison.

The shared [native-cache replay](../native-cache-replay.mjs) owns admission, native
parity and matched quality analysis for these configuration experiments. Pass the
repository root, hydrated alternative-evidence root and this evidence folder;
an optional final case ID evaluates one retained case. Without it, replay checks
the protocol's complete case order and stop rule, plus every manifest-listed
observation and execution receipt. It reads only and performs no inference.
The [integrity tests](../native-cache-replay.test.mjs) prove omitted failures and
altered receipts/resource summaries are refused; hydrated parent operands may be supplied through
`YAP_SPEAKER_PARENT_OPERANDS`.
The [bounded invocation test](../native-cache-invoke.test.py) proves a timeout
retains its transport receipt without running inference.

This null result narrows the next experiment to the documented buffer/context
recipe or a distinct provider. It does not prove native-path equivalence for all
lengths, ragged batches or untested inputs. Training overlap, reused confirmation
data, unsealed source/runtime layers and absence of known-person/word attribution
remain explicit in the protocol.
