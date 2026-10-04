# Optional MCP delivery

CLI is the primary agent interface. An MCP client can instead invoke the installed
`screenrec` launcher with `mcp` as its argument. Both expose the same operation
registry, revision rules and durable retry identities; MCP setup is not required
for CLI use.

If MCP returns `resultDelivery`, read its token through `artifact.read` at
successive offsets, renew before expiry when needed, verify the complete byte
count and SHA-256, decode the UTF-8 JSON response, and close the token. Interpret
that response's `ok`/error and data before continuing. Do not resend a write
merely to obtain inline JSON. The result lease does not renew nested media
tokens. After expiry or restart, use only the operation's advertised recovery
or exact-request replay contract; an unavailable token does not imply rollback.
Ready media can also remain metadata-only when its complete MCP message would
exceed transport bounds. A batch can defer all its images together; its item
errors and delivery tokens stay intact. Read the needed tokens through the
artifact operations and manage each expiry independently. Metadata-only delivery
does not mean the media is empty.

An MCP receive/connection failure can follow a committed edit. If its client
cannot receive the full receipt, replay the identical saved params through CLI
when available; do not create a new mutation ID just to recover a reply.
