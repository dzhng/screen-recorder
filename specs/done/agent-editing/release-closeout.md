# Personal release disposition

The user authorized release on 2026-10-03: “if you're just waiting for me to test
the product, just finish up the spec and release the app.” This closes the build
plan with the available implementation and verification. Additional product
review, physical observations and broader measurement coverage are accepted
limitations of this release, not prerequisites for delivering it.

Screen Recorder 0.1.0 is installed at `~/Applications/Screen Recorder.app`; the
bundled CLI/MCP launcher is `~/.local/bin/screenrec`. This is a personal-host
release using its recorded Node 24 interpreter. It is not a portable public binary
release. Capture and model preparation remain explicit caller actions.

The [release receipt](release.json) records the installed bundle identity, signature,
default service health and complete help catalog. The earlier
[developer update](assets/acceptance-maintenance/personal-correction-update.json)
pins the reviewed capability and caption-replacement corrections. Subsequent changes
close documentation and relocate verification fixtures; product code is unchanged.

The implementation-end repository run and focused recoveries are retained in the
[preservation registry](assets/23-owner-fixture-ports/README.md). The final corrections
passed four native wire tests, three CLI help checks and ninety composition tests,
plus composition type/build checks. The [capability receipt](assets/acceptance-maintenance/native-capability-verification.json)
retains its real red/green regression and unchanged accepted capability contents.
No second full-suite, inference campaign or recording is required by this closeout.

## Accepted limitations

- Speech is best effort. Broader independently labeled disfluent coverage, held-out
  timing and additional protected joins remain unverified; existing raw estimates,
  omissions and failed numerical results remain recorded.
- The existing four-minute take meets the requested duration. Its retained marker
  evidence does not establish the one-frame physical synchronization bound. Actual
  selected-device loss and staggered physical-start observations remain incomplete.
- The sustained Stop/quit and saved-source retry cases pass their declared scopes.
  They do not establish every device lifecycle or a general performance guarantee.
- Sampled visual boundaries and muted endpoint playback pass. The integrated output
  has no complete listening or uninterrupted perceptual review verdict.
- The storage test passes in isolation and during qualified smaller workloads.
  Its original heavy-compilation deadline remains unverified. Historical full-run
  failures remain visible; this release does not claim every gate was green.

These limitations do not authorize automatic editorial choices, hidden timing
corrections, altered numerical thresholds or destruction of originals. Future
concrete defects return to their existing code owners with focused verification.
The archived [acceptance disposition](assets/acceptance-maintenance/release-gates.md)
links each observation to its retained evidence.
