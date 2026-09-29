# Focused operation discovery

Operation-specific help uses the same registry as full CLI help and MCP. It
selects before generating schemas, so asking about one operation need not load
all unrelated parameter trees. Bare help remains the complete offline catalog;
unknown names fail explicitly without contacting or launching the service.

The change follows the literal-caption fresh-agent trial, where the complete
catalog obscured the requested controls. It does not hide settings behind presets
or introduce a separate documentation schema. Whole-workflow acceptance remains
under slice25.

The regression first fails because selected help returns every operation, then
passes with exactly the requested public schema. Existing schema assertions were
stale after still-image inspection landed: a raw still can omit a timestamp while
frame batches still require times. Those expectations now match the established
public contracts. Both original failures are retained separately.

Independent read-only review found no actionable defect. The first complete CLI
run hit five existing five-second deadlines in non-help flows; its results are
retained, rather than treating the focused discovery pass as full-suite evidence.

All 30 adapter checks pass in the bounded 20-second diagnostic run; the original
five-second suite deadlines are unchanged. A default rerun reports two timeouts,
including the expanded help test. Separating operation-specific help into its own
case keeps the same assertions and gives all three offline help cases a default-
deadline pass. The other timed-out multi-command transport flow is unchanged by
this help-only implementation. Its default performance gate remains open for the
broader suite; diagnostic success does not erase those failures.
