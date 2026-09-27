# Main-worktree integration checkpoint

Build: all nine workspace build tasks pass, including the local macOS bundle.
No installed application or personal library was changed or launched.

The [native asset gate](assets-native.txt) passes all four cases through the
rebuilt native probe. [CLI/MCP](assets-cli-mcp.txt) exercises import, metadata,
provenance pagination, deduplication, unsupported-codec diagnostics, source
removal and restart replay through the shared isolated service.

[Core/service/CLI preservation](core-service-cli.txt) passes 515 of 516 tests.
The inherited storage inventory test exceeds its unchanged five-second deadline
while the native build and format tests run concurrently. The complete
[isolated storage suite](storage-isolated.txt) passes all 13 checks. A
[separate profile](storage-profile.txt) measured about 1.49 seconds to create the
inventory and 1.53 seconds to scan it, while 10,728 unrelated catalog reads
progressed. This is one diagnostic sample, not a general latency guarantee or
proof that load-sensitive timing is solved. No timeout, fixture or storage
implementation changed; slice 24 retains the concurrent deadline evidence.

Independent admission review caught unbounded provenance in asset.get. Its
metadata-only response and separately paginated asset.origins now pass a public
10,001-origin regression and real CLI/MCP traversal. Atomic queue admission has
separate rollback and full-capacity replay regressions. This checkpoint accepts
these isolated-service contracts; production capture cutover and the full editor
remain unfinished.

Render, stretch, source-speech and generated-speech experiments retain their own
quality gates. Integration of a frozen research artifact is not production
adoption or acceptance of an unmeasured perceptual claim.
