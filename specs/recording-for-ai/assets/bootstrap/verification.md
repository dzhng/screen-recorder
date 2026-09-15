# Bootstrap verification

The Bun/Node workspace and SwiftPM native app build on the inspected Apple Silicon
macOS host. `bun run lab:bootstrap` exercises the actual bundled native executable;
its shared-fixture result is in [native-conformance.json](native-conformance.json).

The strict-request test was observed red before validation was implemented. An
empty operation fixture also exposed a TS/Swift mismatch (UNKNOWN_OPERATION versus
INVALID_REQUEST); the native boundary was corrected and all seven fixtures pass.
The Swift process tests cover a valid request following malformed/invalid lines.

Build, TypeScript checks, the focused bootstrap test set, lint, and signature
verification passed. The app was launched from dist and its process remained alive.
Computer Use could not obtain the accessory app's AX state (timeout); the Finder
screenshot surface returned blank. This is not evidence of menu readability.
Native visual validation remains pending; capture permissions have not been requested.
The runnable bootstrap allows independent capture/model/timeline work to proceed.

Codex independently reviewed the bootstrap and identified missing shared Turbo
inputs: native tests could be cached after helper edits and TS tasks after a shared
compiler-config edit. Native process/conformance tests now run uncached, the root
compiler config is a global input, and the default test graph includes actual bundled
conformance after native build. All affected checks passed after the fix. Codex's
sandbox could not rebuild Swift module caches; root native builds/tests above did.
