# Verification boundary

The user requested completion with live-device checks unverified and lean UI
verification. The planned physical reproductions, expanded screenshot matrices
and full-suite ceremony were superseded, not passed.

Final native product compilation succeeded with:
`swift build --build-system native --package-path apps/macos --product ScreenRecorder --jobs 2`.
Existing PreviewController weak-capture and SwiftPM build-system deprecation
warnings remain; there were no compile errors.

The production Capture and Library views were rendered with synthetic idle facts
in light and dark appearances. Independent visual review accepted the final four
shots after correcting the Library ellipsis, paging layout and sidebar divider.
The approved reference drove tile/device-row geometry and the separate Library.
These captures omit outer native window chrome and do not prove installed-app
focus, permissions or live recording.

A read-only code review found countdown synchronization, live Finish applicability
and tracked Library command identity issues. All three were corrected before the
final successful compilation. No new test machinery or full suite was run at
closeout. Existing probe consumers were updated for the removed menu.

Live camera, microphone and system-audio checks are **UNVERIFIED**. No physical
capture or app installation was performed. Earlier evidence directories preserve
only their own stated fixture, publication, admission and paging observations.
