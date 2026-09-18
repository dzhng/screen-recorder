# Countdown and recording overlay captures

The two panels a take puts on screen, from the built app (`dist/ScreenRecorder.app`) on
macOS 26.6.2, in both system appearances.

| Shot | Panel | What it shows |
| --- | --- | --- |
| [light-countdown-three.png](light-countdown-three.png) | countdown | light, the first second of the count |
| [light-countdown-two.png](light-countdown-two.png) | countdown | light, one second later |
| [dark-countdown-three.png](dark-countdown-three.png) | countdown | dark, the first second of the count |
| [dark-countdown-two.png](dark-countdown-two.png) | countdown | dark, one second later |
| [light-recording.png](light-recording.png) | controls | light, a take recording at two seconds |
| [light-paused.png](light-paused.png) | controls | light, the same take paused |
| [dark-recording.png](dark-recording.png) | controls | dark, a take recording |
| [dark-paused.png](dark-paused.png) | controls | dark, the same take paused |

[`apps/macos/tests/overlay-shots.mjs`](../../../../apps/macos/tests/overlay-shots.mjs) writes
them. Each is the panel's own picture, drawn by the window it belongs to and written straight to
a file through the controls fixture, at twice the size a point is on this screen: the controls
are 296 by 64 points and the count 186 by 180. Nothing is photographed off the screen and
nothing is brought forward — the run that produced these records this app's own fixture window,
never activates the app, and orders every panel it opens in behind whatever the person is doing.
The
system appearance of the Mac they were taken on is light; the dark pair is the same launch asked
to show itself the other way.

A panel's own picture leaves out what is behind it, so the material backdrop reads as flat here
and the panel's shadow is missing, where on screen both are there. What the panel draws — its
shape, its spacing, its type and its controls — is exactly what a person sees.

The count is a still surface on purpose: it takes no clicks, so that a person clicking during it
clicks on whatever they are about to record, and Escape is the way out. Finishing a take and
throwing one away are the two actions that must never be confused, so one is the recorder's red
stop and the other a bin; recording is a red dot and paused an amber one.

These panels are never in a recording: the window server is told not to share them, and a take of
a whole display also leaves out this application. The frame-level proof of that is
`apps/macos/tests/capture-exclusion.test.mjs`.
