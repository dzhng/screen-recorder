# Loaded audio stays available for marking

Historical repair packet. The current [guided waveform workflow](../12d-waveform-guidance/README.md)
preserves complete audio loading and replaces the long marking form.

The listener reported a zero-duration player and unclear instructions. The
prepared local server had stopped. The restored server runs independently of
its launching command session. The browser fetches the complete unchanged
original before enabling marking, so an already loaded clip remains available
for replay and seeking even if that server stops. A reload still needs the
server, and saving always needs it; loading and saving failures preserve the
visible inputs and report the failure.

The page asks the listener to hear the sentence once, seek back, and mark the
start and end of “uh” first. Playback and the precise clip playhead stay visible
while the listener scrolls through the remaining items. Unclear edges stay blank.
Recording provenance is available in a collapsed details panel. The original
clock, source binding and confirmation authority are unchanged.

[Root verification](root-verification.json) records the restored process, exact
HTTP clip hash, complete browser buffer and successful paused near-end seek
after stopping a disposable server. [Tests](tests.txt) retain the existing
source-clock, draft/partial export and exact range checks. No audio was played
automatically and no human marks were manufactured. Independent listening marks
remain the next pickup; this repair closes no speech acceptance gate.

[Player preview](player-preview.jpg) and [marking preview](marking-preview.jpg)
show the final candidate. The [complete capture set](captures.tar.xz) retains
every captured intermediate and final state, including enlarged crops. The
candidate differs from the preceding viewport by 387,750 pixels. The fresh
visual critic first identified scrolling friction, a buried first target and
unclear listening order; the candidate resolves those findings. Both root and
critic found no blocking clipping, overlap or zero-duration display. The pinned
player covers part of the waveform after scrolling, so full waveform seeking
requires scrolling back. Screenshots do not establish audible acceptance.

Focused shape/diff/docs review is clean: the browser owns loaded-media readiness,
the server owns target order, and the existing shared clock owns export times.
No dependency, daemon service, audio transform or label inference was added.
The configured Codex CLI review remains unavailable after its unsupported-model
rejection; no successful independent CLI review is claimed. The earlier
[marking packet](../12d-sentence-marking/manifest.json) remains a historical pin;
the repair's [manifest](manifest.json) owns this candidate's retained bytes and
source hashes.
