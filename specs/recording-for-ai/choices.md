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
