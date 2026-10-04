# Active consumer lease renewal

`DerivativeDelivery` remains the single owner of cached media pins. Its explicit
renew operation extends the same live token's finite expiry and refreshes the same
automatic-release timer. Reads still do not implicitly renew. Expired, closed or
deleted-recording tokens cannot be brought back to life.

This supports a native player using a pinned private cache URL while retaining the
existing deletion and crash behavior. The player must renew while using the file,
including when paused, and stop using it if renewal fails or its deadline passes.
A separate downloaded app copy would require another storage/deletion owner; this
contract avoids that copy. Native playback implementation remains a separate gate.

[Unit results](renewal-service-tests.txt) exercise real cache pins with a controlled
clock: renewal crosses the old deadline, the new deadline releases the pin without
another client call, and both expiry and recording revocation refuse resurrection.
The initial missing-method run was red before implementation. [Public results](renewal-public-tests.txt)
exercise renewal through the actual MCP registry and reject it after public
recording deletion. Existing read/close semantics and cache removal checks remain
in the same delivery suite.

Independent Codex review found no actionable defect and independently ran all 11
delivery tests. Host delivery/deletion checks, service types and focused lint pass.
The change adds one shared operation and refreshes an existing timer; it adds no
storage owner, queue, configuration or dependency.
