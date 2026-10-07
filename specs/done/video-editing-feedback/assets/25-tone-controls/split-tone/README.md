# 25B split-tone LUT response probe

This retained probe uses the existing immutable `.cube` owner with a caller-authored
33³ linear-sRGB transform: a bounded red lift in shadows/highlights and blue
counter-lift, with green neutral. The independent analytic reference fixes the
same endpoints, neutral midpoint and channel curves before encoding. It is a
representation checkpoint, not an automatic editorial grade.

`report.json` records the native worker request, recipe and full-raster result.
The delivered candidate matches the independent reference at MAE0.0113 and
maximum one code value over 172800 RGB bytes. The source is the frozen25A graded
wall shot; all geometry and source interpretation remain fixed. The public receipt
under `public/` independently imports the chart and LUT through CLI/MCP, retains
neutral/shadow-color/highlight-neutral masks, and matches within one code value.
This closes the declared 25B acceptance envelope without claiming arbitrary
reference-conditioned movie fidelity.
