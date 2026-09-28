# Blind export skill journey

A fresh `gpt-6-luna` agent received only the product skill, built CLI, isolated
socket, corpus media path and an existing scratch destination. Code, tests, specs,
git history and database access were forbidden. It independently discovered the
advertised schemas, imported the fixture, placed its video/audio over 0–1.5 seconds,
previewed it and obtained a committed video export. No implementation hints were
supplied.

The agent inspected a preview image and probed both streams. Parent verification
read the [pinned revision](revision.json) and [export status](status.json) through
the actual CLI, independently matched preview/export/receipt hashes and fully
decoded the [delivered movie](export.mp4). The [verification](verification.json)
records those checks. Synthetic fixture audio presence/duration and exact byte
identity do not establish listening quality; neither reviewer played speakers.

The agent reported that complete CLI help is a large JSON schema document, so it
filtered the relevant advertised schemas. It otherwise reported no workflow
confusion. The skill validator passed. The scratch service and directories are
retired after retaining this evidence; installation and the full tutorial in
slice 25 remain separate acceptance.
