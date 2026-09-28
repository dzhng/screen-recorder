# Fresh project-index skill use

Two fresh agents used only a frozen product skill, public help, CLI responses and
delivered images against an isolated six-second project. They did not inspect
implementation files or mutate the project. The setup trace, exact skill inputs,
raw receipts, failed commands and image outputs are retained unchanged.

The [initial report](initial/report.md) correctly read composition and dry versus
processed placement, but did not fetch coverage rows. The skill was clarified to
request coverage as well as entry pages. The [second report](coverage/report.md)
then fetched all seven images and the actual sampled/unproven coverage rows.
Its table is correct, but its prose incorrectly calls 2.25–2.30 seconds unproven,
although the preceding base-only displayed frame covers 2.20–2.30 seconds.
Authored boundaries and output sample boundaries are different clocks.

The second agent also observed that direct frame metadata gives a one-microsecond
request range while index candidates/coverage give the full displayed frame
interval. This competing use of `visibleRange` is an open clarity issue. Neither
report is accepted as complete autonomous inspection proof. A follow-up must
establish consistent metadata through the compiler's existing frame clock and
repeat fresh public use, preserving native graph validation and image parity.

Both agents recovered from documented CLI invocation mistakes; the failed
receipts remain evidence. The scratch service was stopped afterward. The skill
validator was unavailable because the local Python environments lack PyYAML;
no dependency was installed for validation.
