# Settings window captures

Captures of the real window from the built app (`dist/ScreenRecorder.app`) on macOS 26.6.2,
each the window's own drawing, written by `node apps/macos/tests/settings-shots.mjs`. The window is 560 points wide and as
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

Light appearance is set on the running app rather than on this Mac, and the window is opened
through the menu's own Settings action. Nothing is clicked and nothing is activated: a launch
with the controls fixture set orders every window in behind whatever the person at the Mac is
doing.

In every capture the launch preference reads off, because the harness that launches the app
for a check turns it off so no window can appear over someone's work. A person's own install
starts with it on.

