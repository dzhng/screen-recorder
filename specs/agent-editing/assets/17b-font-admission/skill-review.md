# Fresh-consumer font skill review

## Outcome
PASS for the bounded admission/identity/library/replay/restart workflow. No unexpected public-operation failure. This is a usability exercise, not a code-diff review or proof of caption readiness.

- Native SHA-256 matched the supplied `f0dc9e11c37d6d96f8a6a00362f5b7772de916cb4ad4e5b33130bcf10b0b54b3`.
- Started with an empty library in fresh home `/tmp/srf-4toF51`; all operation calls used its explicit socket. The installed service/library was not used.
- Both imports initially returned running jobs; subsequent `job.get` returned ready and an asset identity.
- Arial.ttf: 773236 bytes, one face: `ArialMT` / Arial / Regular.
- AlBayan.ttc: 186408 bytes, four faces: `.AlBayanPUA` / .Al Bayan PUA / Plain; `.AlBayanPUA-Bold` / .Al Bayan PUA / Bold; `AlBayan` / Al Bayan / Plain; `AlBayan-Bold` / Al Bayan / Bold.
- Explicitly selected `ArialMT` and `AlBayan` by exact returned name and immutable asset ID. See `chosen-faces.json`. These are recorded consumer choices, not a submitted caption mutation. AlBayan is deliberately not the collection's first face.
- Listed both entries through limit-1 pagination to a null cursor, then listed the full library after repeat imports and restart.
- Same request IDs and paths recovered the same jobs. New request IDs for the same paths produced distinct jobs resolving to the same asset IDs; the library remained two entries.
- After a clean service stop/start with the same isolated home, complete asset metadata and the library response data were identical, and original import replay recovered ready jobs and original IDs. All 13 value-based checks in `verification.json` passed.
- One deliberate negative probe reused the Arial request ID with the AlBayan path: exit 1, `REQUEST_CONFLICT`, message `Import request ID already names another path`, retryable false. Saved unchanged as `13-conflicting-replay.*`; no corrective workaround was needed.
- The isolated service was stopped on completion; see `stopped.json` and service process exit 0.

## Font dependencies versus playable media
Public help explicitly describes fonts as non-timed assets without playable streams. Both `asset.get` receipts have `streams: []` and named `fontFaces`; listing reports `streamCount: 0`, `mediaKinds: []`, and `fontFaceCount` 1 or 4. A face is selected by asset ID plus PostScript name, not a media stream ID or installed-family lookup. The returned `originUs: 0` does not create a playable clock or stream. No stream ID was invented to force a frame/audio request. No playable media was imported for comparison; the distinction is grounded in advertised semantics and these actual font responses.

## Usability
The font paragraph and operation descriptions were sufficient to complete the task without implementation-based repair. They make the collection-selection hazard explicit, and the four-face collection demonstrated why the warning matters. The replay contract and the refusal were clear. CLI stdin parameters, JSON envelopes on nonzero exits, and complete cursors worked as documented.

Minor discovery friction, not established defects: the font guidance is deep inside a broad recording/editing skill, and its frontmatter does not mention font admission. Help supplies request schemas but the job-result and face-field response shapes were learned from actual receipts. Family/style/name metadata lets a consumer choose explicitly, but does not explain PUA variants or certify glyph coverage; the skill correctly requires separate verification.

## Limits and prior knowledge
Task-behavior sources were the copied public `SKILL.md`, public CLI `--help`, and live CLI responses. The supplied setup provided the built CLI path, native path/hash, and permission to use JourneyService. Generic Python/Node subprocess, JSON, filesystem, and SHA-256 knowledge was used for evidence plumbing. No earlier task reports or product implementation/spec/tests were consulted for behavior.

Repository root instructions and the required repository-local code-review skill were read as review procedure, not task behavior. While reading the permitted fixture to understand JourneyService startup/stop, the displayed 1–240-line slice also incidentally included adjacent model-copy/acquisition-fixture helpers. Those were not used or followed for task discovery; this was an avoidable overbroad infrastructure read, so the run is not represented as literally having seen only the JourneyService class. No other helper implementation was read. JourneyService was used only to start/stop/restart and obtain the socket; raw calls bypassed its response-unwrapping `call()` so full CLI envelopes and refusals could be retained. Its automatic MCP connection was infrastructure only: MCP discovery/parity was not exercised.

No font installation, caption rendering, glyph-coverage testing, project text mutation, global registration check, crash-recovery check, byte-level managed-storage inspection, or repository edits were performed. Persistence means the public metadata/job/library results survived a clean restart. Selection is not evidence of shaping quality or caption readiness.

## Evidence index
- `SKILL.md`: public skill snapshot; `help.*`: complete CLI discovery stdout/stderr, exact argv and exit status.
- `01-*`–`16-*`: every public operation attempt, including polls and the intentional refusal. Each has exact authored params (`request.json`), full argv (`command.json`), unfiltered stdout (`stdout.json`), stderr and exit status. No rejected request was overwritten.
- `chosen-faces.json`: exact immutable face references, assembled from saved receipts.
- `verification.json`: explicit identity/metadata/replay comparison results.
- `service.mjs`, `call.py`, `repeat.py`, `verify.py`: all authored service/transport/check scripts, retained under /tmp only.
- `home.txt`, `socket.txt`, `lifecycle.jsonl`, `restarted.json`, `stopped.json`, `service.*`, `service-logs.txt`, `service-report.json`, `native.sha256`: isolation, lifecycle and native identity evidence. The helper's trace is empty because public CLI calls were captured directly.
