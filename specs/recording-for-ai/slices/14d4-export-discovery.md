# Export discovery after restart

Status: verified through public CLI/MCP restart discovery and the
[native export controls](../assets/export-controls/README.md), which rediscover and
abandon an unfinished export after a real bundled-service restart.

Native application release requires rediscovery of persisted export IDs. A lost
window or process must not hide a failed request, an unfinished export or private
cleanup behind completed history. The existing MediaExports owner provides a
read-only summary page; status remains the detailed lifecycle authority. Discovery
never retries, admits, reconciles or recreates an intent.

The shared operation registry owns request bounds and strict CLI/MCP parameters.
Pages use lexical export IDs and bind the recording and unfinished filters into the
cursor. This is a live listing, not a snapshot: removed IDs stay gone and arrivals
before the cursor require a fresh traversal. Page size may change during traversal.

Unfinished includes uncommitted intents, abandonment and known private payload or
assembly cleanup. A committed receipt remains committed while cleanup is pending.
The cleanup indicator describes private staging and assembly obligations; an
acknowledged commit retires its staging directory, so a finished export never needs
its destination folder again. Abandonment has its own flag
and remains unfinished even when payload bytes are already clear.

Two partial indexes support unfinished global and per-recording traversal without
scanning completed history; existing indexes serve full history. Summary queries
select a bounded page before joining existing job identities, so no full status
payload or filesystem observation is needed. No new table, scheduler or ordering
sequence is introduced.

The native adapter discovers unfinished summaries at launch, service restart and
menu open, then requests status for each. It preserves committed receipts while
cleanup is pending and uses the existing explicit retry/abandon actions.

[Verification receipt](../assets/export-discovery/review.md) records actual public
restart discovery and lifecycle coverage.
