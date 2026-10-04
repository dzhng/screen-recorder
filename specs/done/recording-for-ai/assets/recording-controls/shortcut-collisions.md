# Native shortcut collision feasibility

The collision gate remains open. A real two-process Carbon probe on this host
found that the current non-exclusive registration succeeds even when another
process exclusively owns the same combination. The recorder reports the binding
as held although the SDK says it will not receive events while that owner exists.
The [current-mode assertion](shortcut-exclusive-collision.txt) fails on that claim.

An exclusive-registration candidate correctly rejected that exclusive owner and
reclaimed the combination after it exited. However, extending the same probe to
an existing non-exclusive owner produced another [failed collision assertion](shortcut-shared-collision.txt):
the candidate registration succeeded. According to the SDK, an exclusive owner
suppresses non-exclusive notifications. The candidate was therefore removed; it
would violate the requirement not to take over another application's shortcut.
No production shortcut behavior changed, and no passing collision gate is claimed.

The local macOS SDK's CarbonEvents.h documents these registration modes and the
suppression behavior. Its CopySymbolicHotKeys API enumerates enabled system
Keyboard preferences shortcuts, explicitly excluding application-specific command
keys. That API alone cannot prove the complete cross-application collision contract.
A later pass needs a supported strategy for truthful availability and noninterference,
including limits of what macOS exposes; switching one registration flag is insufficient.

The probe compiled the production GlobalShortcuts owner and controls module, held
Control–Option–Shift–Command–9 in a separate process, then attempted registration
from a second process. Both holder modes reached their explicit readiness receipt.
No key event was synthesized and no recording or audio capture occurred. Child exit
was awaited before scratch cleanup. These are registration results, not physical
shortcut delivery or screenshot evidence. The temporary failing probe stayed out
of the default test suite. Independent review of the candidate was terminated when
the extended host experiment invalidated it; no independent approval is claimed.


A separate [two-process registration matrix](shortcut-registration-matrix.json)
confirms all four mode combinations directly against Carbon on macOS 26.6.2.
Only exclusive-over-exclusive returns an error (-9878); both shared-over-exclusive
and exclusive-over-shared return success. Every fixture owner registered successfully,
and each child exited after unregistering. This pins the API limitation without
changing product code or inferring physical key delivery from registration success.
