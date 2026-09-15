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
against that child's PID alone within a bounded deadline. A quit arriving as
SIGTERM is routed through the normal terminate path, since a menu-bar agent has no
window to close. If the app dies abruptly instead, the same pipe reaches EOF and
the child stands itself down.

Node 24 is a personal-host prerequisite, not a bundled runtime. A Finder launch
inherits launchd's minimal environment rather than a developer shell's PATH, so
the build records the absolute interpreter it validated against and the app
prefers that, falling back to the standard install locations and only then to
PATH. Every candidate must answer `--version` with Node 24. Set `SCREENREC_NODE`
to an absolute path to override; an override that fails is reported rather than
quietly replaced, which is the whole point of setting one.

Command-line arguments still select the native capture probes, which run instead
of the menu bar and without the service. Frame, recovery and capture behavior all
belong to [helpers/mac](../../helpers/mac/README.md).
