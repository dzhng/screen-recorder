# Settings window captures

Captures of the real window from the built app (`dist/ScreenRecorder.app`) on macOS 26.6.2,
each `screencapture -l <window>` of that window alone. The window is 560 points wide and as
tall as the screen allows; its form scrolls when it cannot show everything at once.

| Shot | Appearance | Permissions |
| --- | --- | --- |
| [light-not-allowed.png](light-not-allowed.png) | light | neither access answered yet |
| [light-allowed.png](light-allowed.png) | light | both allowed |
| [light-denied.png](light-denied.png) | light | both denied |
| [dark-not-allowed.png](dark-not-allowed.png) | dark | neither access answered yet |
| [dark-allowed.png](dark-allowed.png) | dark | both allowed |
| [dark-real-permissions.png](dark-real-permissions.png) | dark | this Mac's real TCC record |

Only `dark-real-permissions.png` shows what macOS has actually recorded for the development
build: screen recording allowed, microphone never asked. The other five state their access
through `SCREENREC_FIXTURE_PERMISSIONS`, which replaces what the window displays and nothing
else, because changing the system's own TCC record for a screenshot is not something a check
may do. Every button in those shots still performs the real request or opens the real pane.

Light appearance comes from `-NSRequiresAquaSystemAppearance YES` on a Mac whose system
appearance is dark. The captures were brought forward through the accessibility API rather than
by clicking, and the automated checks never activate the app at all: a launch with the controls
fixture set orders the same window in behind everything.
