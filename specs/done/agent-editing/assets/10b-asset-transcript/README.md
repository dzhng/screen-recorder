# Asset transcript planning and execution

`TranscriptProcessing` admits real asset jobs through the existing queue and sends
selected source support to the same native transcriber and raw indexer used by
recordings. Asset jobs pin the selected stream/context, support digest, source
duration and model/policy identity; interval arrays stay out of queue identities.
A model change names new work. Reads do not revive a failed or canceled attempt,
and model readiness never downloads anything.

Queue admission now offers a synchronous callback inside its transaction, after
assigning the real job ID. Asset and acquisition references therefore commit with
the job, including replay; a callback failure rolls them both back. There is no
second queue or reference ledger. Startup cleanup pages assets and retains every
running or published transcript attempt across stream/model identities. Individual
cleanup failures do not starve later assets.

## Verification

- Focused queue/transcript/store/page gate: 79/80 passed; the unchanged large-history
  queue test timed out at 5 seconds during concurrent builds. Its isolated rerun
  passed without changing its timeout or assertions. The original failure and
  rerun are both retained, not represented as one all-green run.
- Seventeen recording service/deletion/package-guide tests passed after local
  core/protocol/service builds. Core/service type checks and changed-code
  formatting/lint passed.
- Three actual native narrated package publication/reopen journeys passed against
  the frozen native executable used by the preceding ownership pass. The harness
  supplies speech output; this is package preservation, not fresh native ASR.
- Selected-source tests exercise negative origin offsets, distinguishable streams,
  narrower/empty acquisition support, real job dependency references, explicit
  model states, cancellation/retry, multiple retained generations and a changed
  model digest. Native decoding is a boundary fixture in these tests.
- Mutating the requested stream causes all four then-existing asset scenarios to
  fail publication. Omitting the queue admission callback breaks atomicity's
  expected rejection. Both restored implementations pass their focused gates.
- Existing retained 306-word/raw-byte native parity remains in the focused suite.

Independent CLI review found only a readonly test-model digest assignment, also
caught by the local typecheck. The fixture now exposes mutable state through its
readonly getter. No production finding was reported.

Public source query routing, real selected-stream inference through CLI/MCP,
restart journeys, and listening quality remain separate enclosing-slice gates.
