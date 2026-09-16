# Implementation choices

## Bootstrap and tooling

### Local bundle identity

- **When:** bootstrap.
- **Decision:** build a locally ad-hoc-signed ScreenRecorder.app with stable bundle
  identifier com.david.screenrec. Its status-bar label is ScreenRec.
- **Gap:** the project had no product name, signing identity or distribution setup.
- **Rationale:** a stable local app identity supports later macOS permission testing;
  public signing/notarization belongs to the separately planned public release.
- **Consequence:** the personal build needs no distribution account; public release
  must explicitly choose its signing and product identity.

### Build dependency pins

- **When:** bootstrap.
- **Decision:** pin the installed registry versions of TypeScript, Vitest, Turbo,
  oxfmt, oxlint, Zod and Node 24 types; Bun and Node retain the spec's runtime split.
- **Gap:** the spec delegated exact dependency versions.
- **Rationale:** one lockfile and exact direct versions make the initial toolchain
  reproducible rather than copying another repo's older numbers without a reason.
- **Consequence:** updates are deliberate dependency changes and require focused checks.

### Native build caching

- **When:** bootstrap.
- **Decision:** disable Turbo caching for the native bundle build and process/conformance tests;
  include the shared TypeScript compiler config in global cache inputs.
- **Gap:** package-local build outputs do not describe the root .app directory.
- **Rationale:** a cached success must not skip creating the actual app after output
  deletion. Swift already performs incremental compilation.
- **Consequence:** root builds always invoke native packaging/signing, and native process checks
  execute even when inputs outside the app package change.

## Actual-agent inspection

### Evidence without personal recordings

- **When:** image-access gate.
- **Decision:** use randomly generated digit PNGs and an isolated Claude Code
  session to prove both MCP image blocks and CLI-file image ingestion.
- **Gap:** the spec needed an actual-client proof before any recorded fixture existed.
- **Rationale:** hidden expected text plus retained tool exchanges distinguishes
  seeing pixels from receiving a plausible file path or inferring a scripted answer.
- **Consequence:** this establishes the transport/client boundary only; readability
  of real screen recordings and the eventual edit loop still need their own gates.

## Speech evaluation

### Repeated-word alignment

- **When:** local speech preparation.
- **Decision:** compare words in order, then use their times to break equally good
  text matches. A repeated “like” close to the observed audio is preferred over a
  distant occurrence; timing never excuses a worse transcription.
- **Gap:** the acceptance gate specifies timing accuracy but not ambiguous matching.
- **Rationale:** choosing the last repeated occurrence by array order can turn one
  omitted word into an invented multi-second timing error. Sequence plus proximity
  preserves the distinction between missing words and bad boundaries.
- **Consequence:** ambiguous matches use the reference timing; this small annotated
  evaluation remains evidence for the fixture, not universal speech accuracy.

### Keep raw inference evidence

- **When:** local speech preparation.
- **Decision:** preserve upstream reports in a separate directory beside normalized
  results, including when the recording itself is named “result”.
- **Gap:** diagnostic layout was unspecified.
- **Rationale:** separate paths prevent filename collisions without rejecting valid
  recording names. Raw confidence/segment data remains available for review.
- **Consequence:** the test harness retains both reports; production artifact layout
  remains owned by the processing slice.

## Revision persistence

### Bound database contention

- **When:** durable revision transactions.
- **Decision:** wait at most one second for a competing SQLite writer, then return
  retryable `STORAGE_BUSY`. The same request ID can safely be retried.
- **Gap:** the spec required bounded waiting but did not choose the duration.
- **Rationale:** edit transactions are short; brief contention should succeed while
  a held lock must not freeze the caller indefinitely. No custom retry loop or
  second storage authority is needed.
- **Consequence:** lock contention can surface as a retryable result. The service
  must keep encoding and transcription outside these transactions.

## Local transport

### Sound — medium confidence

#### Accept a request when its complete JSON line arrives

- **When:** 06b local transport.
- **Choice:** A client sends a JSON message ending in a newline and keeps the socket open while waiting. Once that valid bounded line arrives, the service may run its handler. Waiting for the client to close its writing side would prevent the server from observing a later disconnect on the tested Node Unix sockets. Later bytes cannot undo an already accepted edit.
- **Gap:** The plan specified one request per connection but did not specify whether newline or end-of-stream establishes acceptance.
- **Reach:** All clients must use the same framing convention; handlers receive a cancellation signal when the live connection closes. The returned signal cannot reverse a committed database transaction.
- **Verdict:** Sound. This keeps client disconnects observable without adding a session or acknowledgement protocol; the framing parser rejects invalid or oversized frames before dispatch.
- **Confidence:** Medium.

#### Put correlation ID alongside the operation result

- **When:** 06b local transport.
- **Choice:** A response contains the caller's `id` together with `ok` and either `data` or `error`. A client verifies this ID against the request snapshot it actually sent. Reusing the caller's JavaScript request object for another operation cannot change that in-flight comparison.
- **Gap:** The plan required a correlated typed envelope but left its exact outer shape unspecified.
- **Reach:** Future CLI and MCP adapters can pass through the same operation result without another nested transport result object. Existing request parsing remains strict; response parsing tolerates additive metadata according to the project review rules.
- **Verdict:** Sound. One shared protocol schema owns both success/error variants and their correlated response forms.
- **Confidence:** Medium.

#### Close invalid request connections; keep operation failures structured

- **When:** 06b local transport.
- **Choice:** If incoming bytes or the request envelope are invalid, the service closes that connection without invoking a handler. It does not invent a trusted request ID from malformed data. A valid request whose handler fails receives a correlated error; an oversized handler result produces `LIMIT_EXCEEDED`. Such an error does not imply that a prior mutation was rolled back.
- **Gap:** The plan required rejection but left server-side error behavior for uncorrelatable input and oversized output unspecified.
- **Reach:** Clients distinguish transport failures from domain results and retain request IDs for explicit replay after uncertain outcomes. Registry/domain handlers remain responsible for actionable domain errors; unexpected thrown failures become a generic internal error.
- **Verdict:** Sound. This avoids dispatching malformed requests or leaking arbitrary internal exception text while retaining correlated errors wherever an accepted ID exists.
- **Confidence:** Medium.

### Sound — high confidence

#### Refuse a pre-existing runtime directory that is not already private

- **When:** 06b local transport.
- **Choice:** The listener creates missing directories privately, but an existing directory must already be owned by the current user with mode 0700. If somebody passes a shared directory such as `/tmp`, startup refuses it instead of changing that directory's permissions. The actual socket is set to 0600.
- **Gap:** The plan required a private runtime directory without specifying repair behavior for an existing unsuitable path.
- **Reach:** Application setup must supply its own private runtime directory. The listener never changes access to unrelated pre-existing directories.
- **Verdict:** Sound. It meets the privacy contract without changing arbitrary user filesystem permissions.
- **Confidence:** High.

The no-live-unlink invariant and direct libuv-owned socket cleanup were explicitly clarified by the parent during this pass and should be treated as the updated plan, not a new inferred lifecycle mechanism. Internal names, fixture locations, and package scripts follow delegated implementation discretion.

## Native finalization

### Wait for a busy encoder without blocking capture control

- **When:** native finalization, Claude Opus pass plus integration review.
- **Choice:** If Stop reaches an encoder that is still busy, observe its readiness
  and append the held final frame when it can accept data. Give that readiness wait
  two seconds, then report an interrupted result if the frame still cannot be
  accepted. Recheck actual writer status/readiness at the deadline. This replaces
  immediate failure on ordinary backpressure without waiting indefinitely.
- **Gap:** The capture contract did not choose a readiness wait mechanism or budget.
- **Reach:** A stopped take can finish normally after a brief encoder backlog. The
  two-second bound applies to accepting the held frame, not a guarantee about every
  container-finalization operation. App lifetime/recovery must handle failure there.
- **Verdict:** Sound. A single readiness observation and deadline fit the existing
  push-style capture input; real AVFoundation tests reached backpressure and decoded
  the appended frame. There is no polling loop or general retry framework.
- **Confidence:** Medium. The precise budget is an engineering default, not a
  measured universal limit; a healthy case exceeding it warrants revisiting it.

## Native acquisition and frame execution

### Sound — medium confidence

#### Record accepted audio ranges beside media

- **When:** native recovery checkpoint.
- **Choice:** When an audio buffer is accepted by the writer, append its time range
  to the capture journal. Recovery intersects decoded audio with those ranges. For
  example, if narration begins a quarter-second late, decoder-generated leading
  silence cannot be mistaken for captured speech. Without the journal, decoded audio
  remains accessible but is explicitly unverified as acquisition evidence.
- **Gap:** The plan required honest usable audio intervals but did not account for
  the platform decoder synthesizing padding inside a nonempty audio track.
- **Reach:** Transcription must consume verified acquired ranges. Per-buffer journal
  writes are flushed by normal OS writes; durable capture transitions synchronize
  the journal. Sudden power-loss guarantees remain outside the tested contract.
- **Verdict:** Sound. Media decoding proves readable bytes; the acquisition journal
  separately proves what was recorded. Neither source of evidence substitutes for
  the other.
- **Confidence:** Medium. Generated PCM and actual device interruption still need
  separate verification before accepting the full recording workflow.

#### Expose frame execution as a native worker operation

- **When:** 09a native decoder integration.
- **Choice:** The core supplies an immutable source path, a time interval that survives
  the edit, and a destination for the PNG. The native worker returns the actual frame
  timestamp and file details. It does not search the library or reinterpret edits.
  A later service pool can cancel a worker process without putting media decoding on
  the menu-bar app's control thread.
- **Gap:** The plan required a worker binding but did not prescribe its internal
  request shape or allocation boundary.
- **Reach:** The service must resolve revisions and allocate derivative paths before
  dispatch. Frame caching, concurrency and cancellation remain service work; this
  operation adds no second timeline owner.
- **Verdict:** Sound. The operation is a thin boundary over the existing decoder,
  with strict request fields and no additional library or state store.
- **Confidence:** Medium. Worker lifetime and reuse still need measurement when the
  service composes it into the complete inspection path.

## Shared native sample timing

### Sound — high confidence

- **When:** recovery timing correction.
- **Choice:** Frame inspection and crash recovery share one translation between a
  video's internal sample times and the timeline shown to a caller. If an edit
  shifts a frame by 200 ms, both readers apply that same shift before interpreting
  the frame's timestamp or duration.
- **Gap:** The plan assigned native media execution one owner but did not name the
  shared utility needed when both recovery and image selection read edit lists.
- **Reach:** Future native media readers should use `ScreenRecorderMediaTime` rather
  than recreating timestamp conversion. It adds one Swift target, no external dependency.
- **Verdict:** Sound. A real fixture showed a 300 ms under-report from mixing the
  two clocks; a single mapping prevents the corrected readers from drifting apart.
- **Confidence:** High.

## App-owned service startup

### Sound — medium confidence

- **Choice:** The app resolves its build-recorded Node interpreter, with explicit
  override and conventional installation paths, instead of bundling Node. A Finder
  launch therefore does not depend on the developer shell's PATH.
- **Gap:** Personal-host Node 24 was specified; interpreter discovery was delegated.
- **Reach:** Moving or removing Node requires rebuilding or setting the override.
  Tester/public packaging remains separate work.
- **Verdict:** Sound within the personal-host prerequisite. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Hold an operating-system file lock for the service lifetime before
  reclaiming a dead socket. The lock file stays in place; process death releases
  ownership automatically.
- **Gap:** The plan required a single owner without prescribing the lock mechanism.
- **Reach:** Startup uses macOS file-lock semantics; no custom stale-PID lock owner
  or extra native launcher is added.
- **Verdict:** Sound. **Confidence:** High.

- **Choice:** Normal app quit waits for a bounded interpreter probe to finish
  cleanup, and prevents any late startup callback from launching the service.
- **Gap:** The plan did not name ownership during interpreter validation.
- **Reach:** Quit can take the remainder of the probe deadline and escalation;
  forced app death while probing a noncooperative executable is outside this guarantee.
- **Verdict:** Sound. **Confidence:** High.

## Service library binding

### Sound — medium confidence

- **Choice:** Open the catalog during service startup, after claiming ownership,
  and make an unusable catalog a reported startup failure.
- **Gap:** The plan specified one catalog writer but did not say whether opening
  the database was eager or deferred until the first library call.
- **Reach:** Ordinary launch creates the empty catalog; readiness now means the
  library can be opened as well as the socket. A damaged catalog prevents a false
  ready state and is reported through the existing bounded startup path.
- **Verdict:** Sound. **Confidence:** Medium.

## Cursor retention and recording lifecycle

### Sound — medium confidence

- **Choice:** Keep at most 240 recent native geometry placements in memory while
  preserving the full recorded geometry journal. If a delayed reading predates that
  retained window, keep its raw point and mark its projection unknown.
- **Gap:** Sampling was required to be bounded; retention during a long pause with
  continuing window movement was unspecified.
- **Reach:** A very delayed point may need later reconstruction from the journal;
  the worker does not invent a placement to hide a dropped in-memory entry.
- **Verdict:** Sound. **Confidence:** Medium; the count remains a measured tuning
  point rather than a promise about a fixed number of seconds.

### Sound — high confidence

- **Choice:** Retain a canceled take's catalog identity as a tombstone, excluded
  from latest and unavailable to revision/history/edit reads.
- **Gap:** Cancel removes a take from discovery, but request replay still needs to
  resolve its former identity and reject late capture results.
- **Reach:** Media deletion remains service work; the retained metadata prevents
  a replayed start from creating a second take or reviving discarded evidence.
- **Verdict:** Sound. **Confidence:** High.

- **Choice:** Finalize an interrupted take only after recovery has determined
  whether video exists. A terminal zero-video outcome and an attached duration
  cannot replace each other later.
- **Gap:** The precise transaction boundary around recovery was unspecified.
- **Reach:** Service reconciliation must finish validating media before publishing
  a terminal interruption; it cannot use zero-video as a temporary processing state.
- **Verdict:** Sound. **Confidence:** High.

## CLI/MCP adapter seam

### Sound — high confidence

- **Choice:** Keep transport correlation IDs separate from durable mutation request
  IDs, and retain a parsed transport ID even when local JSON validation fails.
- **Gap:** Mutations already required replay identity; the CLI's error behavior
  before a service call was unspecified.
- **Reach:** Automation can correlate failed invocations while retrying edits with
  their original mutation identity. Invalid command-line syntax is diagnosed on
  stderr, which also protects MCP's stdout before mode parsing has succeeded.
- **Verdict:** Sound. **Confidence:** High.

## Recording discovery

### Sound — high confidence

- **Choice:** Browse recordings newest first using the last returned creation
  sequence as the continuation boundary. Recording states and current revisions
  are read when each page is requested.
- **Gap:** The spec bounded recording lists but did not choose their order or
  whether list pages freeze the whole recording's metadata.
- **Reach:** If a new take starts between pages, the agent continues through older
  takes without duplicates or a shifting offset. A new traversal finds the new
  take. A recording that finishes meanwhile reports its current state; opening it
  by ID still resolves and pins the inspection revision separately.
- **Verdict:** Sound. **Confidence:** High.

## Native audio excerpts

### Sound — medium confidence

- **Choice:** Support mono and stereo excerpts; refuse wider layouts with an
  explicit unsupported-format error. A mono track reaches both channels when mixed
  with stereo, and no channel is copied into an invented surround position.
- **Gap:** The app's audio contract did not specify surround-channel mapping.
- **Reach:** Ordinary narration and system-audio inspection work; a future wider
  input layout needs an explicit mapping and its own verification.
- **Verdict:** Sound. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Inspection excerpts use float PCM WAV at the higher source sample
  rate. Output placement rounds cumulative playback time once at each boundary.
- **Gap:** The excerpt container and mapping from microseconds to indivisible audio
  samples were unspecified.
- **Reach:** Many tiny cuts cannot accumulate duration drift. Rate conversion may
  need a read ending up to one output sample beyond the nominal microsecond range
  to produce those allocated samples. Requested edit spans remain unchanged; human
  video encoding and its AAC soundtrack stay with the video renderer.
- **Verdict:** Sound. **Confidence:** High.

## Local request admission

### Sound — high confidence

- **Choice:** Limit open local connections separately from unfinished handlers;
  reject excess work instead of buffering it. An abandoned handler keeps its slot
  until it actually finishes, even if its client disconnects.
- **Gap:** Individual frame sizes and timeouts were bounded, but simultaneous local
  connections and requests had no total admission limit.
- **Reach:** Repeated client timeouts cannot build an unlimited queue behind native
  capture. A saturated handler pool gives a retryable limit error; saturation before
  request parsing closes the connection. The caller decides whether to retry.
- **Verdict:** Sound. **Confidence:** High.

## Capture request recovery

### Sound — medium confidence

- **Choice:** If a native start and its cleanup stop both go unanswered, retain the
  take as unproved. A retry attempts to end that same take and recover its media,
  rather than starting another or reattaching the caller to an ongoing capture.
- **Gap:** The spec required durable replay but did not prescribe recovery after
  both control answers are lost while the service is still alive.
- **Reach:** The caller may receive a recovered interrupted recording instead of a
  continuing capture. It never receives a false terminal no-video answer while the
  device may still be running. `UNRESOLVED_START` remains retryable until an outcome
  can be proved.
- **Verdict:** Sound. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Start and restart share a capture-allocation request-ID namespace,
  with canonical source/audio/target arguments stored beside the allocated take.
- **Gap:** Capture replay's precise identity scope was unspecified.
- **Reach:** Retrying the same request returns its existing identity across service
  relaunch; reusing that ID for another operation, source or audio choice fails with
  `REQUEST_CONFLICT`. Callers use a fresh ID for a new intended take.
- **Verdict:** Sound. **Confidence:** High.

## Cursor evidence styling

### Sound — medium confidence

- **Choice:** Keep a readable minimum trail width and pointer size in the delivered
  image, even when the caller scales the screen down. Cap the pointer minimum on
  tiny thumbnails. Use a magenta trail with a dark halo and a white arrow.
- **Gap:** The spec required readable fading evidence but did not choose styling
  or the tradeoff between small marks and covering recorded content.
- **Reach:** Small outputs retain recognizable pointing evidence, at the cost of
  covering more of the underlying label. Paths and hotspots never move to avoid
  content. A clean or larger image resolves obstruction; arbitrary backgrounds
  and very small text cannot be guaranteed readable from these fixtures.
- **Verdict:** Sound, reversible styling. **Confidence:** Medium.

## Durable work identity

### Sound — medium confidence

- **Choice:** Store each distinct recording/revision/artifact/input combination
  separately. An exact repeat returns its existing result or failure; only an
  explicit retry creates a new attempt and generation. Canceled work can be
  explicitly retried while its recording still exists.
- **Gap:** The spec required pinned results and one automatic attempt but did not
  choose the queue's exact identity or canceled-job retry semantics.
- **Reach:** A later edit or different frame option cannot receive an earlier
  job's result. Source-only processors should explicitly use the original revision;
  transcript projection through edits must not start recognition again. Derived
  cache eviction and retained-evidence lifecycle still require their own owners.
- **Verdict:** Sound. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** The queue owns its job/artifact tables in the existing catalog
  connection and allows 32 waiting jobs in addition to the prescribed active slots.
  Inputs are canonical strings supplied by each artifact's owning adapter.
- **Gap:** Storage layout, pending admission limit and executor payload shape were
  implementation choices.
- **Reach:** There is one metadata writer; overload is explicit rather than an
  unbounded backlog. The queue does not interpret transcription or media settings.
  New adapters must define stable inputs and pass cancellation to the native runner.
- **Verdict:** Sound. **Confidence:** High.

## Cursor evidence transfer

### Sound — medium confidence

- **Choice:** Export normalized cursor/geometry observations to a caller-owned JSONL
  file through the existing native journal reader. Limit a transfer to 256 MiB of
  input and output and keep the provenance header within 16 KiB.
- **Gap:** The spec required bounded raw-history access but did not choose the
  ingestion format or per-worker transfer budget.
- **Reach:** Core can ingest evidence once without copying native geometry rules or
  loading all samples into memory. Very large journals produce an explicit limit
  error; chunked ingestion beyond that budget is not implemented. Public pagination
  must use the later index, not rescan this file for every page.
- **Verdict:** Sound for this bounded internal seam. **Confidence:** Medium.

## Personal app discovery

### Sound — medium confidence

- **Choice:** Let the client locate a personal app through `SCREENREC_APP` or the
  default user Applications path. If an app already runs with another library home,
  leave it running and let discovery of the requested home time out.
- **Gap:** The launch/home mismatch behavior was unspecified.
- **Reach:** A client cannot silently restart a recording app or switch its library.
  The caller can select an existing socket, or quit and relaunch the app with the
  intended home. The error identifies the requested service and connection options.
- **Verdict:** Sound. **Confidence:** Medium.

## Source processing admission and raw reads

### Sound — medium confidence

- **Choice:** Automatically prepare cursor evidence for every finalized usable take,
  including takes discovered after relaunch. For example, if the app stops after
  saving a recording but before scheduling its evidence, relaunch finds the missing
  job and schedules it. A take whose processing actually failed stays failed until
  the caller explicitly retries.
- **Gap:** The spec required durable readiness but did not choose how finalization
  and job admission recover when only one of the two transactions committed.
- **Reach:** An ordered scan of recordings reuses the queue's durable job identity;
  no second queue or recurring timer is introduced. Capacity becoming available
  admits the next missing take, even when the initial backlog exceeds queue limits.
- **Verdict:** Sound: closes the crash gap while preserving deliberate retry.
  **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Raw cursor pages remain in original source time after edits. If an
  agent cuts the first second, a sample originally at two seconds still says two
  seconds in a raw query; an edited frame reader separately maps it to playback
  time. Page tokens identify the source, published processing attempt and time
  range, so changing those inputs cannot silently splice two result sets.
- **Gap:** The spec required raw access but did not prescribe continuation identity.
- **Reach:** Raw observations are reusable evidence rather than another edit-owned
  copy. Future projected cursor reads must label their playback coordinates and
  retain the source references.
- **Verdict:** Sound: immutable evidence and edited views keep distinct meanings.
  **Confidence:** High.

## Abandoned evidence lifecycle

### Sound — high confidence

- **Choice:** Reclaim unfinished cursor derivatives after startup and before another
  attempt for the same recording. Suppose a process dies halfway through indexing:
  the next service removes that abandoned attempt's files and rows, while leaving
  the original video and the published attempt untouched. A canceled worker still
  writing counts as active until it actually exits, even if a retry is already queued.
- **Gap:** Durable jobs identified interrupted attempts, but the spec did not name
  the owner that removes their unpublished files and partially indexed records.
- **Reach:** Source processing owns this narrow cleanup; it is not the cache policy
  or user recording deletion. Scans stream candidates and delete rows in batches,
  so cleanup can yield to client requests and abort before catalog shutdown.
- **Verdict:** Sound: prevents repeated interrupted attempts accumulating unused
  evidence without treating a canceled-but-running worker as safe to delete.
  **Confidence:** High.

## Cache regeneration

### Sound — high confidence

- **Choice:** Regeneration names the exact published generation it found missing.
  For example, two frame readers notice an evicted file; the first starts a new
  decode, and the second cannot erase that new work using its old observation.
  The new decode keeps the original requested edit revision even if the user cuts
  the recording while it waits.
- **Gap:** The cache contract required evicted files to be recreatable but did not
  specify the queue transition or its stale-observer protection.
- **Reach:** Disposable media owners use regeneration for cache misses; ordinary
  retry of completed retained evidence remains idempotent. Queue admission and
  obsolete-publication removal happen together, so a full queue loses no metadata.
- **Verdict:** Sound: cache eviction does not weaken durable attempt identity.
  **Confidence:** High.

## Disposable cache ownership

### Sound — medium confidence

- **Choice:** Hold cached files in a dedicated directory with accounting in the
  library catalog. A reader acquires an open file handle and pins that entry until
  release; if all candidates are held, another publication reports retryable
  pressure instead of evicting a file somebody is reading.
- **Gap:** The spec fixed the cache budget and LRU policy but not read lifetime or
  restart accounting. A pathname alone could disappear before a client reads it.
- **Reach:** Frame/audio producers must publish only completed output, and service
  delivery must release handles on success, error, timeout and shutdown. Startup
  reconciliation runs before producers and repairs missing files without touching
  source media or retained evidence. Native per-output limits bound pending files.
- **Verdict:** Sound: cache pressure cannot silently truncate an active delivery.
  **Confidence:** Medium.

## Image delivery lifetime

### Sound — medium confidence

- **Choice:** The service gives a ready image a short-lived read token, transfers it
  in chunks and closes it after delivery. A token lasts at most 30 seconds, no
  matter how often it is read; at most 32 tokens may hold files, and one read is
  capped at 512 KiB. If a client disappears, expiry releases the file automatically.
- **Gap:** The spec allowed images larger than a metadata socket response but did
  not choose the binary transfer or abandoned-reader lifetime.
- **Reach:** CLI and MCP consume the same bytes without racing cache eviction.
  Repeated offsets remain deterministic, including the final chunk. Slow callers
  can request a fresh image delivery; they cannot pin cache files indefinitely.
- **Verdict:** Sound for bounded local image delivery. **Confidence:** Medium.

### Sound — medium confidence

- **Choice:** CLI image inspection uses an explicit output path when supplied, or
  creates a temporary PNG and returns its absolute path. It refuses to overwrite
  an existing file. MCP returns actual image content alongside matching metadata.
- **Gap:** The spec required a CLI file but did not choose its default destination
  or collision behavior.
- **Reach:** An external agent can inspect the returned local path immediately;
  users who want a retained destination pass one explicitly. Temporary images are
  delivered files, separate from the service's evictable internal cache.
- **Verdict:** Sound and reversible. **Confidence:** Medium.

## Streamed source timing

### Sound — high confidence

- **Choice:** Emit completed audio intervals when a gap or end of input proves
  their end, while emitting cursor observations as they arrive. A narration span
  can therefore appear after cursor samples whose timestamps fall inside it.
- **Gap:** The normalized evidence format did not prescribe ordering across event
  types. Sorting the entire recording would require retaining all its events.
- **Reach:** Consumers index explicit source timestamps instead of treating file
  order as global chronology. Native recovery and export share the same merge
  rule; only one pending interval per audio role is retained during streaming.
- **Verdict:** Sound: bounded export preserves timing without inventing a second
  clock or parser. **Confidence:** High.

### Sound — high confidence

- **Choice:** Malformed audio roles, negative times and empty acquisition intervals
  end the trusted journal prefix. If a damaged record claims another audio role,
  export keeps earlier valid evidence and reports the stopping boundary instead
  of extending the role set or pretending the record was valid.
- **Gap:** The source timing extension needed a corruption rule for new records.
- **Reach:** Only captured narration/system roles enter excerpt planning; incomplete
  pauses remain explicit without fabricated elapsed time.
- **Verdict:** Sound: consumers can distinguish missing evidence from silence.
  **Confidence:** High.

## Public audio delivery and background admission

### Sound — medium confidence

- **Choice:** Audio delivery allows up to 48 MiB while PNG delivery retains its
  existing 32 MiB bound. A maximum thirty-second, stereo, 192 kHz float excerpt
  needs about 46 MB of sample bytes, so the shared transfer must carry that
  native-supported result instead of refusing it because images are smaller.
- **Gap:** The spec bounded excerpt duration but did not choose adapter byte limits.
- **Reach:** Both CLI and MCP use one chunk reader; this bounds transfer memory,
  but does not guarantee every external MCP host accepts the largest audio block.
- **Verdict:** Sound and reversible: covers the full native output bound.
  **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Automatically admit one source-processing job at a time. When many
  old recordings need indexing at startup, one can use the single heavy worker
  while a foreground image or audio request still has room in the waiting queue.
  Finishing a job admits the next old recording. Explicit retries remain targeted.
- **Gap:** The shared queue's waiting limit did not prescribe backfill admission.
- **Reach:** Startup and capture finalization share the same admission rule;
  background work cannot fill every waiting slot without increasing throughput.
- **Verdict:** Sound: preserves background progress and foreground access.
  **Confidence:** High.

### Sound — high confidence

- **Choice:** The native audio writer chooses WAVE independently of the output
  filename. An opaque cache path ending in .cache therefore contains the same
  WAVE bytes as a user-facing .wav file.
- **Gap:** Cache naming and the native staging-file suffix had incompatible owners.
- **Reach:** Cache storage stays media-independent; the decoder owns its container.
- **Verdict:** Sound: one owner for each independent decision. **Confidence:** High.

## Shared visual observations and comparisons

### Sound — medium confidence

- **Choice:** A scene boundary can be either a large changed image area or a
  smaller change spread across many cells. Scrolling a mostly white webpage
  moves thin text across the screen; requiring a large changed area alone can
  miss it. A compact caret or button highlight does not reset the synthetic cases.
- **Gap:** The spec delegated deterministic thresholds but did not prescribe them.
- **Reach:** Local trails and whole-recording screenshot selection share this
  comparison policy. Real UI acceptance must tune it before default trails ship;
  broad animation can still look like a boundary and very brief states can be missed.
- **Verdict:** Sound as a provisional measured heuristic, not semantic recognition.
  **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Keep requested times, actual decoded times and their distance, and
  compare each distinct decoded frame once. Several requests during a static
  frame retain their coverage records without inventing visual transitions.
  Include the requested endpoint and a preceding sample inside the kept span.
- **Gap:** Sampling boundaries and held-frame comparison were not fully specified.
- **Reach:** Chunked analysis can carry its previous observation forward and use
  the same comparison policy. This does not decide where a cursor trail belongs
  when the nearest frame comes from before or after the request.
- **Verdict:** Sound: preserves the evidence needed for that later timing decision.
  **Confidence:** High.

## Native decode retry classification

### Sound — high confidence

- **Choice:** A native media decode failure permits another explicitly requested
  attempt. If an audio file temporarily cannot be opened, subsequent reads keep
  reporting the failed result; a retry request may start the decoder again. The
  same rule applies to frames. Bad request shapes and invalid ranges stay terminal.
- **Gap:** The native error envelope had marked every failure terminal, even
  transient file access, codec and allocation failures.
- **Reach:** One shared wire policy owns this classification. A corrupt file can
  still fail on every explicit attempt; retry permission promises no repair and
  creates no automatic retry loop or source-repair capability.
- **Verdict:** Sound: preserves deliberate retry without hidden background work.
  **Confidence:** High.

## Ordered frame batches

### Sound — medium confidence

- **Choice:** A valid batch can succeed while individual images are pending or
  failed. For example, five cached images remain usable when a sixth cannot be
  read. The top-level response and CLI exit code report a valid batch; callers
  inspect each item's explicit result. Invalid input rejects the whole batch
  before any work starts, whereas runtime failures stay local to an item.
- **Gap:** The eight-image limit did not choose batch failure semantics.
- **Reach:** MCP image content indices identify ready items even when other items
  produce no image; callers must not treat top-level success as all-images-ready.
- **Verdict:** Sound and reversible: preserves useful results without hiding
  individual failures. **Confidence:** Medium.

### Sound — medium confidence

- **Choice:** An explicit CLI batch destination is a new directory. Ordered names
  keep repeated timestamps distinct. An existing directory is refused without
  modifying its contents; callers polling a partly ready batch use a fresh
  destination or request remaining images individually.
- **Gap:** The spec did not choose multi-image output layout or collision behavior.
- **Reach:** Prevents accidental replacement while keeping the existing shared
  single-image transfer path and temporary-directory default.
- **Verdict:** Sound and reversible. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Consume each ready image in order through the existing byte reader,
  release its held cache read, and continue after individual transfer/write errors.
  Duplicate timestamps reuse one frame job but remain separate response items.
- **Gap:** Batch execution and transfer lifetime were not specified.
- **Reach:** No batch queue, new worker, or second transfer owner; each request
  resolves one revision before admitting any of its images.
- **Verdict:** Sound: reuses the existing bounded owners. **Confidence:** High.

## Sparse-frame cursor evidence

### Sound — medium confidence

- **Choice:** A future decoded image may veto an old cursor path but never advance
  cursor time. At requested second 1.5, if the nearest image is from second 2,
  compare it with the last available image at or before 1.5. Compatible pixels and
  pause/geometry evidence allow only gestures through 1.5. A changed screen
  produces an explicitly empty eligible overlay; it cannot borrow a later pointer.
- **Gap:** Nearest video selection and requested-time pointing diverge on sparse
  sources; their compatibility rule was unspecified.
- **Reach:** Local and global consumers share one scene comparison policy. A
  missing past reference is unavailable evidence, not a silent clean fallback.
  Endpoint comparison stays bounded even across long video gaps.
- **Verdict:** Sound as the implementation rule; rendering acceptance remains
  required. **Confidence:** Medium.

## Geometry evidence and delayed source timing

### Sound — high confidence

- **Choice:** Add derived geometry indexes and bounded predecessor/range reads to
  the existing source index. A caller can find the last observed pointer even if
  it was outside the recording, instead of reviving an older inside point.
  Unplaced geometry remains explicitly untimed. Oversized reset lists fail rather
  than silently dropping boundaries.
- **Gap:** Trail planning needed indexed context beyond raw cursor pages.
- **Reach:** Two geometry indexes support these reads without scanning unrelated
  cursor/audio history; no original data or clock mapping is rewritten.
- **Verdict:** Sound: one evidence owner with bounded reads. **Confidence:** High.

### Sound — high confidence

- **Choice:** Confirm an untimed geometry epoch when a usable frame later supplies
  source time. A window resized while paused keeps its raw untimed observation;
  the first eligible resumed frame records its placement under the same epoch.
  No invented geometry change or retrospective timestamp replaces the observation.
- **Gap:** Unchanged geometry after pause or before first video had no later
  placement, because only changed geometry triggered a journal record.
- **Reach:** Geometry records can outnumber epochs. Consumers distinguish a
  confirmation from a reset and never assume delivery order is occurrence order.
- **Verdict:** Sound: the native acquisition owner supplies the missing evidence.
  **Confidence:** High.

### Sound — high confidence

- **Choice:** Use a native pausePlaced record when delayed source zero makes an
  earlier pause placeable. If a valid frame from before a pause arrives after
  resume, keep that media and append the real pause marker once. This record
  leaves any currently open pause intact; it is not another resume operation.
- **Gap:** An earlier pauseEnded could not supply source time before source zero
  existed, leaving media timing without its explanatory pause marker.
- **Reach:** Adds one internal journal event; normalized pause shape stays the same.
  The capture clock owns placement and export remains streaming. Wholly pre-origin
  pauses remain raw controls rather than invented media intervals.
- **Verdict:** Sound: preserves valid video and truthful timeline placeholders.
  **Confidence:** High.

## Requested-time trail planning and delivery

### Sound — medium confidence

- **When:** Core trail planner and public frame integration.
- **Choice:** A stationary pointer does not expire merely because its last sample
  is old. If the pointer was last observed before the requested trail window, compare
  the old and current screen endpoints and check intervening known pauses and
  geometry changes. Matching endpoints permit the old position with its original
  observation time; they do not claim every intermediate screen was identical.
- **Gap:** The plan specified honest cursor history without an age cutoff or a
  method for checking distant pointer evidence.
- **Reach:** Work stays bounded over long quiet periods. A transient change and
  return can escape sampled endpoint comparison; metadata preserves that limitation.
- **Verdict:** Sound provisional evidence policy, with explicit sampled coverage.
  **Confidence:** Medium.

### Sound — medium confidence

- **When:** Core trail planner and public frame integration.
- **Choice:** A window move resets its old path but may retain new pointing over
  a held image when the output pixels have unchanged dimensions and placement.
  A resize or changed scaling cannot reuse mismatched coordinates. A point exactly
  at a pause boundary is omitted because buffered journal delivery cannot prove
  whether it happened before or after the pause.
- **Gap:** Raw placement changes and equal-time controls did not fully define
  eligibility over sparse images.
- **Reach:** Native coordinates remain authoritative. No guessed clock conversion
  or coordinate remapping hides uncertain acquisition evidence.
- **Verdict:** Sound: preserves supported pointing while rejecting ambiguous resets.
  **Confidence:** Medium.

### Sound — medium confidence

- **When:** Core trail planner.
- **Choice:** A frame request fails explicitly when its bounded evidence exceeds
  5,000 raw observations or 1,200 retained rendering points. It never silently
  drops the middle of a gesture to fit a budget.
- **Gap:** The ten-second request limit did not bound unusually dense journals.
- **Reach:** Memory and native payload work stay bounded; callers can shorten the
  requested trail after a limit error. These limits can be tuned without changing
  the no-silent-truncation rule.
- **Verdict:** Sound and reversible operational bounds. **Confidence:** Medium.

### Sound — high confidence

- **When:** Public frame/audio integration.
- **Choice:** Inspecting a newly recorded take admits that take's first source
  preparation before older history that has not entered the queue. It waits behind
  work already running or admitted; failed preparation still requires explicit retry.
- **Gap:** One-at-a-time historical backfill left a current inspection waiting
  behind every older recording unless demand named its source explicitly.
- **Reach:** Frames and audio share existing idempotent preparation and queue
  fairness, without another queue or automatic failure loop.
- **Verdict:** Sound: useful demand makes progress without changing retry promises.
  **Confidence:** High.

### Sound — high confidence

- **When:** Default frame integration.
- **Choice:** Public image metadata carries evidence identity, measured coverage,
  cutoff reasons and pointer timing, while raw RGB samples and complete rendering
  point lists stay internal. A native receipt must confirm the planned selected
  frame and overlay, even when no eligible point remains.
- **Gap:** The plan required inspectable provenance without choosing its response
  size or how to detect disagreement between planning and native rendering.
- **Reach:** CLI/MCP share one compact projection. A mismatch fails rather than
  publishing misleading pixels; raw cursor history stays available separately.
- **Verdict:** Sound: bounded responses with explicit evidence and honest failure.
  **Confidence:** High.

## Shared visual observation reuse

### Sound — medium confidence

- **When:** Observation reuse pass.
- **Choice:** Cache complete bounded native batches by finalized source path,
  exact selection bounds, request times and policy. Two overlapping batches may
  keep duplicate small images; there is no separate file/index per video frame.
  Moving the library causes a cache miss rather than guessing that paths still match.
- **Gap:** The plan required policy-bound observation reuse without choosing its
  storage unit or lookup identity.
- **Reach:** Local and global consumers reuse one sampler. Exact bounds prevent a
  cut or past-only request from borrowing a future image. Batch storage keeps the
  mechanism small; per-frame deduplication remains unnecessary until measured.
- **Verdict:** Sound and reversible: correctness before maximum cache hit rate.
  **Confidence:** Medium.

### Sound — high confidence

- **When:** Observation reuse pass.
- **Choice:** A cache lookup row belongs to its disposable file through a database
  foreign key with cascading deletion. Removing an old file automatically removes
  its lookup; repeated novel requests cannot leave dead rows forever. Concurrent
  requests may decode the same miss, then retain one publication and delete the loser.
- **Gap:** The cache contract did not specify lookup cleanup or concurrent miss handling.
- **Reach:** Existing byte accounting, reconciliation and worker lanes stay in charge.
  Retained scene/index evidence remains outside this disposable lifetime.
- **Verdict:** Sound: platform-owned cleanup without another queue or periodic sweeper.
  **Confidence:** High.

## Durable canonical scenes

### Sound — medium confidence

- **When:** Canonical scene scan integration.
- **Choice:** Whole-source analysis runs as one heavy artifact job with bounded
  ten-second decoding calls. A local frame can use its independent frame lane;
  heavy work already running completes before the next heavy request starts.
  Background discovery admits one scene job, not the entire recording history.
- **Gap:** The plan fixed worker limits without specifying scan admission granularity.
- **Reach:** No second queue or chunk-job dependency graph is introduced. A long
  source scan can delay another heavy request; source chunking bounds memory but
  does not imply preemption of the heavy lane.
- **Verdict:** Sound within the specified single-heavy-job contract; measure long
  native scans before deciding whether cooperative rescheduling is warranted.
  **Confidence:** Medium.

### Sound — high confidence

- **When:** Durable scene store and scan integration.
- **Choice:** Retain one bounded report per canonical chunk plus a generation row
  tracking complete coverage. If a future frame is first selected early, its
  comparison stays at its real video time. Overlapping chunks share a predecessor;
  duplicate comparison pairs are removed while requested-image coverage stays exact.
- **Gap:** Local trail boundary clipping cannot be concatenated into global evidence.
- **Reach:** Screenshot selection and packages can consume durable actual-time
  evidence without rescanning or inventing a second scene detector.
- **Verdict:** Sound: one measurement policy and explicit timing provenance.
  **Confidence:** High.

### Sound — high confidence

- **When:** Durable scene store and scan integration.
- **Choice:** Deleting a partial generation first makes it unreadable, then removes
  bounded batches of rows. A crash during cleanup leaves its identity available
  for the next cleanup pass. Queue publication alone makes a completed scan ready.
- **Gap:** Yielding cleanup must not expose a partly deleted result as complete.
- **Reach:** Startup can reclaim abandoned attempts while preserving active and
  published evidence. Internal deletion state is not another public readiness state.
- **Verdict:** Sound: bounded cleanup and atomic visibility without whole-scan buffers.
  **Confidence:** High.
## Public trail boundary fixture — 2026-09-16

- **Choice:** Reuse the generated page/journal fixture with a denser encoding only
  for cut comparisons. A cut can remove the only frame before the requested
  moment in the sparse video; inserting regular encoded frames lets this test
  judge retained pointing while the original sparse case still judges held frames.
  **Gap:** The plan names cut coverage without prescribing fixture cadence.
  **Reach:** Future cut tests must include a real retained frame when claiming
  successful annotation. **Verdict:** sound; it isolates cut behavior without
  relaxing missing-frame handling. **Confidence:** high.
- **Choice:** Induce retryable source failure by withholding write permission on
  the test's derivative directory. Once repaired, a frame request must still show
  the failure until the caller retries source processing. A malformed journal is
  rejected permanently and would test a different contract.
  **Gap:** The plan specifies explicit source retry without selecting a failure.
  **Reach:** The macOS integration test requires an ordinary non-root account
  whose filesystem enforces directory permissions. **Verdict:** sound; this tests
  a real storage failure and leaves the source journal intact. **Confidence:** high.

## Screenshot selection and retained production — 2026-09-16

### Sound — medium confidence

- **Choice:** Merge separate bounded evidence streams even though a static recording
  may require a linear scan before its first selection event. For a thirty-minute
  still screen, the adapter searches the chunked scene reports for the next boundary
  while keeping only one pending event per stream. An extra stored boundary index
  could shorten that startup, but would add another durable representation to maintain.
  **Gap:** The plan specified bounded memory without selecting the merge access plan.
  **Reach:** Memory remains bounded; startup reads are not claimed constant-time.
  **Verdict:** Sound for the measured baseline, with foreground latency retained as
  a public integration gate. **Confidence:** Medium.

### Sound — high confidence

- **Choice:** Delay candidate emission while an earlier cursor endpoint is unresolved.
  When movement stops just before a coverage screenshot is due, the selector waits
  for observed stillness or a bounded acquisition gap before emitting the later image.
  The gap is labeled missing acquisition, not proof that the cursor stood still.
  Reusing an older image for spacing also preserves any intervening uncertainty.
  **Gap:** Idle confirmation and coverage timing can otherwise reverse output order
  or falsely label changing content as equal. **Reach:** Retained rows remain ordered
  and static-image reuse keeps its evidence limitations. **Verdict:** Sound; uncertainty
  is preserved rather than repaired by sorting or invented observations.
  **Confidence:** High.

- **Choice:** Store coverage separately from selected images and keep a coverage count
  on each image row. A long static segment can reuse one screenshot for many time
  windows; listing that image stays bounded, while the caller pages through its
  coverage separately. **Gap:** One image can have an unbounded number of supporting
  intervals. **Reach:** Public listing and package readers must expose paged coverage,
  not embed the entire interval history in each image. **Verdict:** Sound; both reads
  and storage updates have explicit bounds. **Confidence:** High.

- **Choice:** An open retained-image read keeps its file descriptor until delivery
  releases it. If cleanup unlinks the image meanwhile, an already-started delivery
  can finish from that descriptor. Cleanup continues through unrelated generations
  after a failure and reports a bounded error. **Gap:** The plan required cleanup and
  byte delivery without defining their overlap. **Reach:** Delivery can reuse the
  existing lease lifecycle without copying files or blocking all cleanup.
  **Verdict:** Sound for the local filesystem contract. **Confidence:** High.

- **Choice:** Count a canceled index as occupying the background slot until its
  executor exits. If decoding is still stopping, a new index receives a retryable
  admission limit while foreground work can use the remaining slot. Releasing the
  reservation at the cancel request would allow two decoders to overlap and consume
  both slots. **Gap:** Durable job state alone cannot represent a closing executor.
  **Reach:** The queue exposes active artifact ownership; index admission uses it
  alongside queued/running rows. **Verdict:** Sound; capacity follows actual resource
  lifetime. **Confidence:** High.
