# 07a — Settings window, permissions and launch at login

Status: implemented (2026-09-18), except the login item, which needs this person's
own installed copy. Parent: [07](07-menu-bar-controls.md).

The window, the consistent permission rows, the saved recording defaults, the
renamed bundle and its icon are in place and checked. `SMAppService.mainApp`
reports `notFound` for an ad-hoc-signed build launched out of `dist/`, so the
window states that honestly; registering and unregistering from the installed
`~/Applications/Screen Recorder.app` remains for the person who owns that copy.
[Captures of the window](../assets/settings-window/README.md) cover both
appearances with access granted, unanswered and denied.

The menu bar is the recording surface, but a person should not have to find
permissions or preferences inside nested submenus. Standard menu-bar apps open a
settings window when they start until the person turns that off.

## Contract

- **One permission pattern everywhere.** The Source and Microphone submenus show the
  same shape when access is missing:
  - a disabled status line saying the access is not granted;
  - an **Allow…** action;
  - a separator;
  - the choices available without that access. A missing screen permission names why
    no displays or windows are listed, instead of showing only the grant action.
- **Settings window** (⌘, from a **Settings…** menu item). It is an ordinary, closable
  window and does not keep the app in the Dock. It has four sections:
  - **Permissions.** Screen Recording and Microphone, each with its live status and a
    button that requests access. After a denial, the button opens the matching System
    Settings privacy pane. It never prompts on its own.
  - **Recording.** The microphone choice (off, system default or a named input) and
    Include All System Audio. These persist as the defaults for new takes and are the
    same selection the menu edits; one owner holds it.
  - **Shortcuts.** The current bindings, any that could not be registered, and a button
    that reveals the override file.
  - **General.**
    - **Show this window when Screen Recorder starts** is on by default. The window
      opens at every launch until it is turned off.
    - **Open at login** registers or unregisters the app as a login item with
      `SMAppService.mainApp`. It shows the system state, including "requires approval",
      with a button to open Login Items settings.
- **Application identity in lists.** The installed bundle is named `Screen Recorder.app`,
  carries a real app icon, and is the default discovery path. Spotlight and the
  Applications list show it by that name and icon.

## Owners

Native owns UI preferences in UserDefaults: show at launch, recording defaults,
window state. Login-item state is read from the system, never cached. Capture state,
permissions status and storage still come from the service and native capture.
The menu model and the Settings window read one controls state; there is no second
selection or permission model.

## Verification

- **Controls tests** (`ScreenRecorderControlsTests`) pin the permission row shape for both
  submenus in the granted, undetermined and denied states, the Settings… row and its ⌘,,
  and recording defaults read back through the preference owner on a fresh state.
- **An app-level check** (`apps/macos/tests/settings-window.test.mjs`) launches the bundled
  app against a scratch defaults domain named by `SCREENREC_DEFAULTS`, which production
  ignores unless it is set. It confirms the window opens at launch by default, stays closed
  once the preference is off, opens from the Settings… item, and starts from the saved
  microphone and system-audio choices. Such a launch never activates the app.
- **Login item:** open, and still to do on the installed copy. `SMAppService.mainApp.status`
  is `notFound` for the ad-hoc-signed `dist` build, which is what the window shows.
- **Visual:** [six captures](../assets/settings-window/README.md) of the real window, light
  and dark, with access granted, unanswered and denied, and one with this Mac's real TCC
  record. An unprimed critique reviewed them.
- **Install test:** the installed bundle is `Screen Recorder.app`, carries the icon its
  Info.plist names, keeps the personal identity, and replaces a copy installed under the
  earlier name.
