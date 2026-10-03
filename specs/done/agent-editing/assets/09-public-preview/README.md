# Public project preview integration

Project preview uses the compiler, shared job queue, derivative cache, render
attempt lifetime and delivery-token owner. The service exposes only processors
bound to its renderer. Project deletion immediately revokes its delivery tokens;
held cache reads still delay cleanup until released, preserving retryable deletion.
Original assets and unrelated projects remain intact.

The native movie boundary streams compiled pictures and PCM through the existing
movie assembler. Source selection stays compiler-owned; the service does not
translate projects into recording spans. Startup clears abandoned render attempts
under the existing workspace lock before admitting jobs.

Retained integration checks:

- [Service/protocol](service-protocol.txt): 31 focused checks pass.
- [CLI preservation](cli-preservation.txt): 11 checks pass.
- [State journey](state-preservation.json): actual CLI/MCP project-state coverage passes.
- [Native preservation](native-preservation.txt): all 16 production-wire movie/audio checks pass,
  including the corrected fractional recording endpoint.
- [Blind skill journey](../09-preview-skill/README.md): a fresh external agent creates
  and delivers an independently edited composition using only the skill and CLI help.

A separate read-only Codex review found no actionable integration regressions after
inspecting timing, native request/receipt compatibility, startup, cancellation and
project-scoped delivery. It did not claim to run these integration tests. The shape
review retains one owner per job, cache, render lifetime, assembly and delivery;
this pass adds the compiler-to-native execution boundary and public routing.

These checks do not establish voice naturalness, broader color/codec quality,
long-project scale or durable project export. The [live rendered journey](../09-first-preview/README.md) is retained separately; slice 09 stays open until export acceptance.
