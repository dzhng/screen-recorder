# 24z10 decisions

## Unsound, corrected

**Temporary transaction override — high confidence.** While constructing the relocation fixture, the experiment held one catalog transaction and temporarily ran the store's inner transaction callbacks directly. This kept values but replaced the store's durability behavior with a test-only interpreter. The task allowed investigating setup ownership, not changing how the store is exercised. The corrected decision is to keep every actual transaction and use the runner's existing setup lifecycle. The override was discarded before the final implementation; no production transaction semantics changed and its timings support no final claim.

## Sound

**Separate authored setup from the relocation test — high confidence.** The failing test first creates hundreds of durable fixture rows, then removes the original library and reads the relocated package. The profile shows the deadline expired during creation. A scoped setup hook now creates the identical fixture through the same store, before the relocation test starts. The default hook and test deadlines remain unchanged. This follows root's explicit boundary decision: future readers must treat the original combined deadline as failed evidence and must not infer faster product behavior from the relocated test passing.

**Retain complete data, add complete value proofs — high confidence.** Relocating an index could lose an early image or alter coverage outside the originally selected page while the last leased image still reads correctly. The existing oracle now checks all exported image bytes and independently expected coverage values, alongside complete scene and entry pages and ordinary refusals. A changed first image makes that proof fail. These assertions own package preservation, while sibling tests continue to own cancellation, ordering and lease behavior. No smaller fixture, substitute writer or test-only production API was introduced.

**Stop short of a production optimization — high confidence.** Repeated SQL and portable page decoding may look expensive in a trace, but the original worker profile never reached export or relocated reads. Ordinary per-append commits publish rows and progress atomically. The evidence supports correcting which behavior the test times; it does not justify a new cache, transaction policy or product batching mechanism. Such work would require its own production trigger and measured acceptance seam.
