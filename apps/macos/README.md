# Menu-bar app

An accessory app whose ordinary launch owns exactly one thing: the Node service
child that holds the local socket listener. Launching it starts no capture and
touches no permission-gated API, so it prompts for nothing. Its status menu item
states the service's condition, and the same line goes to stderr, because a
service that cannot start must be visible and actionable rather than silently
retried. The [service contract](../service/README.md) owns the runtime semantics
on the other side of that pipe.

Quit is the child's shutdown signal. The app closes the control pipe first so the
service can close its listener and remove its own socket, then escalates by signal
against that child's PID alone within a bounded deadline. Every quit — the menu
item, SIGTERM (a menu-bar agent has no window to close), or the one the system sends
at logout — takes the same terminate path, which finalizes and stores a running take
before the app exits. If the app dies abruptly instead, the same pipe reaches EOF and
the child stands itself down. A terminal failure follows the same bounded
escalation: a child that answers neither EOF nor SIGTERM is killed rather than
left holding the runtime directory, and every pending call settles with that
failure instead of waiting on a channel nobody is serving.

Control writes are queued asynchronously and bounded by the shared control-frame
limit. A peer that stops reading its stdin therefore surfaces as a settled
`LIMIT_EXCEEDED` rather than filling a pipe and blocking the queue that owns every
pending call's deadline. The menu states readiness or an actionable failure;
process identities, socket paths and interpreter versions are diagnostics and stay
on stderr.

Node 24 is a personal-host prerequisite, not a bundled runtime. A Finder launch
inherits launchd's minimal environment rather than a developer shell's PATH, so
the build records the absolute interpreter it validated against and the app
prefers that, falling back to the standard install locations and only then to
PATH. Every candidate must answer `--version` with Node 24. Set `SCREENREC_NODE`
to an absolute path to override; an override that fails is reported rather than
quietly replaced, which is the whole point of setting one.

Probing a candidate runs a real process, so it never runs on the main thread and
never waits unbounded on one. Each candidate gets its own short budget, its output
is read asynchronously and capped, and a candidate that answers nothing or answers
endlessly is terminated and then killed. One budget, the protocol's call timeout, covers
interpreter resolution and the child reporting its listener together: the deadline is fixed
before the first probe, so a slow interpreter spends the same budget the service
would have, rather than starting a fresh one behind it.

Recording controls have two surfaces and one state behind them: the status menu and
a Settings window. The window sends the same actions the menu does, so neither
holds a selection the other cannot see, and what a person chose to record with —
the microphone and whether the machine's own sound is included — is saved in this
app's defaults domain and is what the next launch starts from. A live take still
owns its own selection while it runs.

A take also has two panels of its own, because a recorder that says nothing leaves a person
guessing when capture began and hunting through a menu to stop it. A start counts down on the
display it is about to record and asks the service for nothing until the count has run out, so
abandoning the count leaves no take behind — and the take never contains the count. While a take
runs, a small panel carries its own elapsed time and the same pause, finish and cancel actions
the menu sends. Neither is a second device state machine or a second clock: what they show, and
whether they are on screen at all, is the one controls state. Both are non-activating panels, so
using them leaves the person in whatever they were recording, and both keep themselves out of
every capture: a recorder's own controls belong to the person recording, never to the recording.
A take of a whole display leaves this application out on top of that, which covers the ordinary
windows it may have open.

Access this app does not have is stated the same way wherever it matters: what is
not granted, the one action that asks for it, and then the choices that remain
without it. Access is read from native capture in this process and requested only
when a person asks for it. macOS shows each prompt once, so an access already
answered opens its privacy pane instead of asking again for nothing.

The window opens at every launch until a person turns that off, which is what a
menu-bar app with nothing else to show is expected to do. Two launches are not
that: one that serves a client's request starts the service alone, and one a check
drives orders the window in behind everything rather than taking the screen.
Whether this app opens at login is the system's answer through `SMAppService`,
read when the window comes forward and never copied into a preference of its own.

The installed bundle is named the way Finder, Spotlight and Login Items read it,
and carries an icon drawn by [a script](../../scripts/render-app-icon.swift) and
checked in beside this README, because a build is not a drawing step.

`--probe <name>` selects a native capture probe instead, which runs without the menu
bar and without the service; any other argument is an ordinary launch. Frame, recovery and capture behavior all
belong to [helpers/mac](../../helpers/mac/README.md).
