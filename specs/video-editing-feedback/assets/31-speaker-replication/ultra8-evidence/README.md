# Eight-slot direct activity research

This bundle tests independently trained direct speaker activity with strict native restoration. The protocol freezes weights, chosen runtime, complete buffer recipe, output clock and interpretation before inference; it supplies no speaker-count truth to the provider. Released configuration uses a standard head despite author training documentation describing split heads. Strict restoration passed without discarded parameters.

[Replay](replay.mjs) accepts the repository root and verifies full native Float32 tensors, native decoder lines, physical support, receipts and unchanged scorer gates. It performs no inference or acquisition. [Results](results.json) retain a first-control pass and a second-control DER failure: overlap and identities survive, but extended false activity exceeds the required quality budget. The stop rule leaves returns and long controls untested; this provider is not admitted.

The model emits native80ms rows. [Clock projection](native-clock.mjs) preserves integer row boundaries and refuses unsupported turns without upsampling or clipping. Cold load is separate from inference, and resource results describe the process rather than external services. The runtime remains an unsealed experimental bundle, not a release.

[Acquisition](acquisition-receipt.json) covers the complete checkpoint; the bounded header probe also downloaded65536 artifact bytes before complete checkpoint acquisition. Neither acquisition readiness nor successful loading establishes quality. [License notice](NOTICE.md) explains why derivative and base-model terms must both survive later packaging.
