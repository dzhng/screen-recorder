# Selected camera input evidence

This packet verifies internal acquisition through controlled device/SDK boundaries
and actual NativeCapture. Exact selection opens only the chosen descriptor;
omitted/denied/absent/disappearing selections cannot silently choose another input.
The media fixtures verify independent camera pictures/timestamps, both PCM roles,
cursor journal values and common pause removal. Physical devices are not acquired.

The lifecycle packet includes startup, interrupted/paused operation, joined
termination, canceled publication/retry and discard. Held preparation, obsolete
returned resources and failed writer construction cannot alter a newer take.
The actual stream-operation owner is exercised with scripted SDK calls: pending
or partially failed starts retain drain authority, caller cancellation prevents
later operations, and repeated drain stops each attempted resource once.

[Verification](verification.json) records runtime identity, scoped gates, deliberate
negative controls and setup attempts. [Preservation](preservation.json) checks the
accepted conversion/retiming and camera append/publication bodies against the base;
serialized media facts retain their existing meaning. [Source identities](source-manifest.json)
bind the runtime review to the complete native source/test tree.

[Root merged verification](merged-verification.json) rechecks all declared source,
archive and log identities and repeats the 29-case selected-input/resource packet.
The merged source matches the tested capture product; no broader native-worker or
timing claim follows.

The archive and [member manifest](manifest.json) retain the bounded fixture media,
raw observations, journals, results and closure counts for the selected-input and
existing camera-publication packets. Logs belong in `logs/`. Absolute scratch paths
inside results describe their original run; extracting the archive does not make
those directories live capture authority.

Prepared wiring and fixture media parity do not establish physical synchronization,
live shutdown, installed-app or public-selector acceptance. No device discovery,
permission prompt, live capture, audible playback, model execution/download/install or
installed switch occurred. Public camera selection and source-allocation/proof
binding remain separate gates. The frozen worker is unavailable at its documented
path; its historical observed hash is retained as history, not a new identity check.
No performance conclusion is drawn under unrelated CPU contention.
