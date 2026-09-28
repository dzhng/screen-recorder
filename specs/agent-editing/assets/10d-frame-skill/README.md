# Picture workflow skill use

The product skill now teaches the distinction between selected-source pictures
and pinned project pictures, missing source evidence and black output, and
requested time and the compositor's global sample. It directs agents to inspect
the live CLI schema rather than copying an operation inventory into the skill.

A fresh `gpt-6-luna` agent with no inherited conversation used the updated skill
against a frozen scratch service. The task asked for two source moments and an
edited project moment without teaching the expected gap or sample-clock answers.
It discovered the CLI, read the asset and project state, polled the same requests,
and delivered the ready PNGs. It correctly identified the missing source moment
as a physical gap and explained that both requested 0.15-second pictures use a
0.10-second sample. The source read used the second track without a fabricated
revision; the project read retained the inspected revision and its first-track
composition. No intervention or revised prompt was needed.

`grade.json` pins the evaluated skill and delivered image hashes. `commands.jsonl`
and `receipts/` retain discovery/read actions, pending and ready receipts, and the
unavailable response. The setup report records actual public asset import and
project creation; no private storage writes created this state. The service
stopped cleanly and its scratch home was removed after retaining evidence.
The same frozen runtime/native identities are recorded in
[the public journey evidence](../10d-source-frame-public/README.md).

This use check establishes procedure and clock interpretation for the supplied
fixture. The child’s brief visual descriptions are not independent acceptance of
project rendering; that remains a separate visual gate. It did not exercise skill
batch recovery, capture overlays, or all import formats. The general skill
validator could not start because its Python environment lacked PyYAML; metadata
and the short instruction diff were reviewed directly. The live use check passed.
