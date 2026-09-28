# Consistent displayed-frame visibility

A requested project picture now reports the whole compiler frame interval in
`frame.visibleRange`; `atUs` retains the precise request. Retained index entries,
coverage and direct pictures therefore agree on when a delivered frame is displayed.
Authored clip edges can fall between global frame samples. The private demanded
native window remains unchanged and is checked before public projection.

The [original regression](red.txt) failed because requesting 75,001 µs at 20 fps
reported `[75001,75002)` instead of the displayed `[50000,100000)` interval.
[Focused checks](focused.txt) now pass 29 tests, including first/exact/final frame
intervals, retained validation and rejection of a native receipt with an incorrect
request window or execution graph. [All core checks](core.txt) pass 615 tests with
one pre-existing skip; [types](types.txt) pass. [Independent review](review.txt)
found no actionable regression and independently ran 21 checks plus types.

The [actual CLI/MCP/native journey](public.json) checks every retained entry's
visibility against its candidate and coverage. All [22 matched PNGs](pixel-parity.json)
are byte-identical to the [prior public run](../10d-project-index-public/README.md).
No renderer, movie timing, source-picture identity or visual output changes.
The project-picture recipe advances to v4 so cached metadata cannot masquerade
as the new receipt. No compatibility adapter is introduced for unshipped metadata.

[Fresh product-skill verification](skill/report.md) now correctly distinguishes
authored 2.25/3.25-second clip edges from displayed 2.3/3.3-second changes. The
agent fetched all entry and coverage pages, inspected delivered pictures, queried
non-grid boundaries and additional interior times, and explicitly retained the
remaining unproven intervals. Its exact skill, public help, commands, receipts and
images are retained. No operation failed; pending preparation was polled. The
scratch service was stopped afterward. This closes this interpretation checkpoint,
not all of slice 10d or autonomous whole-editor acceptance.
