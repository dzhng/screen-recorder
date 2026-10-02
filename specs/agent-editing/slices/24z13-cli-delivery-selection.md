# 24z13 — CLI delivery keeps its selected service

Status: implemented in the isolated source worktree. Three actual CLI/socket
regressions and the affected seven-file consumer suite pass; root integration
remains separate. [Evidence](../assets/24z13-cli-delivery-selection/README.md)
retains baseline failures, source/runtime bindings and closeout checks.

## Contract and ownership

The CLI validates its operation and parameters before discovery, resolves the
service once, then retains that explicit socket selection through dispatch and
automatic single or batch artifact consumption. Dispatch never repeats the
operation. A delivered lease must not acquire another startup budget or app-launch
attempt between items. Retaining a path does not pin a service instance: restart
at that path still invalidates old tokens normally.

The caller in [main.ts](../../../apps/cli/src/main.ts) owns selection. Dispatch
requires a resolved selection; the existing client owns discovery/transport and
[artifact delivery](../../../apps/cli/src/artifact-delivery.ts) owns reads,
renewals, cleanup and file publication. Existing cancellation signals remain on
the selection, and cleanup retains its existing un-signaled close attempt.
No new endpoint, token owner, retry policy, compatibility facade or service API
is introduced. The toolkit makes no editorial choice.

[24z12](24z12-mcp-media-admission.md) preserved historical CLI behavior while
correcting MCP admission and selection. Its completed packet is unchanged; this
slice separately corrects CLI invocation-wide selection. All transport limits,
lease lifetimes, operation deadlines, per-item errors and output-file semantics
remain binding.

## Verification and failure boundary

The owning [CLI tests](../../../apps/cli/src/main.test.ts) use scratch homes,
actual socket listeners, the existing delivery owner and real CLI children.
Single delivery and a duplicate batch must preserve complete metadata and every
file byte, with one initial health probe, one operation dispatch and the required
reads/closes. A middle item failure cannot starve the later duplicate.

After the selected service disappears during a read, preserve the current
truncated-frame error and item isolation. Later items must report the ordinary
selected-socket connection failure, without bootstrap, app discovery or replay.
The fixture uses an absent scratch app path so a failing regression cannot launch
the user's app. CLI child close is awaited and socket/lease cleanup is owned by
the existing test lifecycle.

Retain a baseline falsification for each regression and run neighboring CLI/MCP,
result-delivery, transport, discovery and lease tests with unchanged bounds.
Types, project lint/format and review must pass. These synthetic byte/transport
checks establish no image quality, media execution, installed behavior, latency
or broader release verdict. No visual or audible acceptance is requested.

Internal names and fixture organization are delegated. Any proposal to pin a
service instance, change discovery defaults, alter failure policy or add CLI
signal handling requires a separate contract. Root owns shared handoff updates.
