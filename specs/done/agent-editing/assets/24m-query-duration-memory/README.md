# Timeline duration and bounded-query memory

A two-hour and four-hour timeline use the same10,000 source selections and query
size. Fresh services exclude authoring allocations; only project spacing changes.
Three alternating trials per duration each include cold preparation and20 exact
250-row reads. The complete report retains public traces and every resident sample.

Final median sampled resident peaks were570,785,792 and565,673,984 bytes
(0.99x). Median growth above startup was469,303,296 and463,732,736 bytes (0.99x).
Both remain below the spec's2x boundary. The earlier full run measured1.17x peaks
and1.21x growth and is retained separately; these observations include runtime
allocation variation, not an exact constant-memory claim. This is sampled service
memory on this host, not instantaneous peaks or native decode/movie evidence.
No service instrumentation or new product surface was introduced.

Run `node packages/test-harness/editing/duration-memory.mjs --out <fresh-directory>`
with `SCREENREC_NATIVE` pointing to the native worker. Successful scratch libraries
are removed after each service stops; failures retain their library and report.
The source WAV and complete report are retained with hashes. No playback occurs.

Independent review found an unhandled sampler-rejection path that could bypass
shutdown. The sampler now records failures immediately and cleanup cannot be
skipped by its promise. An injected sampler error exits unsuccessfully, retains
its report and stops the actual service. Followup review has no actionable findings;
the complete six-trial success run was repeated after the fix.
