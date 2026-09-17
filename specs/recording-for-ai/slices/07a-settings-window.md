# 07a — Settings window, permissions and launch at login

Status: planned (user request, 2026-09-18). Parent: [07](07-menu-bar-controls.md).

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

- **Controls tests** pin the permission row shape for both submenus in the granted,
  undetermined and denied states, and the persisted recording defaults applied to a
  fresh launch.
- **An app-level check** launches the bundled app with a scratch defaults suite. It
  confirms that the window opens at launch by default and stays closed after the
  preference is turned off, and that Settings… opens it.
- **Login item:** register and unregister on the installed personal copy, reporting the
  real `SMAppService` status. Record "requires approval" if macOS asks.
- **Visual:** screenshots of the Settings window with permissions missing and granted,
  in light and dark appearance. Compare against native System Settings conventions,
  then an unprimed screenshot-critique last.
- **Install test:** the installed bundle name, icon presence and Spotlight display name.
