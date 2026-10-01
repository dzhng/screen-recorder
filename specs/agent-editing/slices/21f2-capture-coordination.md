# 21f2 — Fresh-service capture coordination and source admission

Status: control wiring planned. The durable acquisition admission seam
[21f2a](21f2a-capture-admission.md) is verified at the source/SQL boundary.
This remains the selector-free second checkpoint of [21f](21f-public-camera-selection.md).

## Contract

Use the surviving CaptureService with the fresh service's one CaptureStore/catalog,
existing private control channel, startup reconciliation and close order. Capture
priority comes from durable takes and uses the existing job queue. Source admission
status comes from durable acquisition intents and jobs; notifications only prompt
work and cannot prove its completion.

After 21f2a, wire actual allocation/stop/replay/reopen and source settlement through
scripted controller boundaries. The caller still constructs projects explicitly.
Public camera selection remains a separate atomic checkpoint after complete21e;
no installed switch, migration or physical capture is part of this child.
