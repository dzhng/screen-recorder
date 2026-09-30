# 24m — Query memory across doubled timeline duration

Status: verified scoped public checkpoint; independent review resolved. Dependencies: [24k](24k-routing-scale.md).

## Contract and control

Doubling timeline duration must not double the memory needed for the same bounded
query. Hold10,000 occurrences, source bytes,100ms clip selections, routing and
250 returned cut rows constant. Only their project spacing and total duration
change between two and four hours. Author both through the public service, then
restart before measurement so editor allocations cannot bias the query process.

The [journey](../../../packages/test-harness/editing/duration-memory.mjs) uses
three fresh processes per duration in alternating order. Each makes one cold read
and20 repeated reads through actual MCP, following continuations and comparing
all250 timestamps with independently authored cuts. Sample the service's resident
bytes every20ms plus command cost. Report both absolute peak and growth above the
fresh startup baseline. Compare cohort medians against the unchanged less-than2x
requirement; retain all trials, including variation.

This is sampled service memory for timeline inspection. It does not measure an
exact instantaneous allocation peak, decoder work, movie-worker memory, larger
clip counts or different query families. No model, long PCM, live device, playback
or product telemetry endpoint is needed. Existing query owners remain unchanged.

Preserve complete evidence under [24m](../assets/24m-query-duration-memory/README.md).
Keep actual row checks, bounded continuations and process cleanup as part of the
measurement. Root owns parent24 status; other open scale requirements stay open.

The matched [transcript checkpoint](../assets/24-transcript-duration/README.md)
also passes the duration-memory comparison and cached250-word reads with real
continuations. Frozen native word rows and a declared model-readiness seam isolate
query work; this is not speech recognition or timing-quality evidence. Phrase-search
throughput is a separate query contract and remains open.
