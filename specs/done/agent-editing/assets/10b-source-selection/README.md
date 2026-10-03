# Shared selected-source support

Direct source inspection resolves the explicit asset, stream and optional
acquisition context into one normalized source clock. The native file offset is
minus the asset origin; a stream beginning later remains later, and selecting a
capture context never subtracts the offset a second time. The selected support
has a stable digest for subsequent transcript/preparation identities. That digest
does not replace the explicit asset/stream/context identity.

Composition and direct source selection use the same intersection primitive.
The existing 114 composition tests pass after its extraction, and six acquisition
checks include physical-only versus masked source selection, exact offsets/support,
repeatability and mismatched source rejection. Core typechecking passes. Independent
code-only review found no actionable defect; it did not execute runtime checks.

This is a prerequisite for asset transcript and audio inspection. No public source
transcript readiness, generated speech quality or waveform delivery is claimed.
