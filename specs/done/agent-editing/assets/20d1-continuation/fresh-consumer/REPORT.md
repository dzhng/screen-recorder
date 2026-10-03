# Product-only recovery exercise

Read only the supplied product skill and CLI help; used the real socket from the supplied context. No implementation/test source reads, capture starts, live-device use, deletions, or source edits. All numbered request files contain exact argv and stdin parameters; response and process files preserve raw JSON, stderr and exit code.

Observed workflow:
- 01 recording.get and 02 capture.status: finalizing, idle native device, no revision/duration. finalizationError INVALID_OUTPUT, permission denied creating private publication staging, retryable:false.
- 03 capture.stop: explicit retry accepted, finalizing with finalizationError:null.
- 04 recording.get: interrupted, interruptionReason PUBLICATION_CONFLICT, finalizationError:null, duration 3176938us, revision r0. This is a settled interrupted take, not a normally completed capture.
- 05 frame.get pinned r0 at 1000000us with clean:true: processing.
- 06 capture.cancel: exit 1, INVALID_STATE, retryable:false; message says a finished take is removed through the library, not canceled; details state interrupted.
- 07 recording.get: same interrupted state, reason, revision, duration and lifecycle sequence. Cancel did not remove the recording.
- 08 identical frame.get poll: ready. 09 same request with explicit output: ready and saved clean-frame.png AFTER the cancel refusal, proving retained readable media.

Media proof: clean-frame.png is 160x120, 31705 bytes. Receipt reports clean:true, annotation:null. Requested playback/source 1000000us, delivered actual 500000us with distanceUs 500000. Viewed image: diagonal grayscale stripe fixture with no visible pointer/trail. media-proof.json preserves hash and observation. No audio or full recording playback verified.

Product guidance observations:
- Recovery instructions were sufficient: distinguish finalizing acknowledgment from terminal state, inspect finalizationError, retry with stop, pin revision, and clean:true for no overlays.
- initial finalizationError.retryable:false is potentially confusing alongside the explicit stop-to-retry instructions. The instructed explicit stop did succeed in settling this fixture; this does not establish retries generally repair permission failures.
- Global help says mutations require requestId and expectedRevisionId, but capture.stop/cancel schemas allow only recordingId. I followed operation-specific schemas successfully. Qualifying the global sentence would reduce ambiguity.
- Full --help was about 10,747 lines / 86k tokens and initially truncated in the tool response. Saved it to disk and selected operation descriptions, then used per-operation help. The skill already recommends per-operation help but asks for full discovery first.
- The recovered interruption reason PUBLICATION_CONFLICT is machine-readable but unexplained in recording.get. I can report the reason, not diagnose the conflict or promise normal capture completion from these interfaces alone.

Outcome: observed recovery settlement, successful clean-frame delivery and finished-take cancel refusal while library media remained accessible. No workaround or media deletion performed.
