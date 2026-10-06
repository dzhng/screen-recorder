# 25B split-tone LUT response probe

This retained probe uses the existing immutable `.cube` owner with a caller-authored
33³ linear-sRGB transform: a bounded red lift in shadows/highlights and blue
counter-lift, with green neutral. The independent analytic reference fixes the
same endpoints, neutral midpoint and channel curves before encoding. It is a
representation checkpoint, not an automatic editorial grade.

`report.json` records the native worker request, recipe and full-raster result.
The delivered candidate matches the independent reference at MAE0.0113 and
maximum one code value over 172800 RGB bytes. The source is the frozen25A graded
wall shot; all geometry and source interpretation remain fixed. Region masks and
an actual public CLI/MCP harness are still required before promoting25B; this
probe establishes only the existing LUT owner can carry the explicit color
response through native delivery.
