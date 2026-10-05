# Permission Settings visual critique

Final recheck on 2026-10-05: reviewed all 20 final candidate full screenshots (560 × 780), then all 20 regenerated same-named before/candidate side-by-side comparisons. All comparison modification times follow their candidate captures. Inspected freshly generated complete Permissions crops in light and dark at 2× after the full views. Target: readable, actionable permissions; intact lower settings within the fixed viewport after scrolling. The new Camera row is intentional.

## Visible issue

- **Scroll discoverability is weaker at the initial position — medium confidence, low severity, non-blocking, visible in full top screenshots.** This observation remains in the final pixels. In every candidate top capture, the complete Shortcuts card ends almost exactly at the bottom of the viewport. No General heading, partial next row, scrollbar, or other continuation cue is visible. Before, the beginning of General peeks into the bottom edge. A user could reasonably read the candidate as the end of Settings and miss General or the shortcut restart note below it. This is a visible affordance concern, not evidence that scrolling fails; a transient native scrollbar may appear during interaction. Normal platform scrolling is a reasonable disposition, with this limited static-view concern retained.

## Checks without a visible defect

- Camera title, explanatory line, orange status icon, “Not allowed yet,” and “Allow…” button are fully visible with clear spacing in both appearances, at full size and in the 2× crops. No overlaps or truncated status text.
- Screen Recording and Microphone labels, explanations, green checks, and “Allowed” statuses remain intact. Section headings, separators, and card boundaries retain a clear hierarchy. The camera addition shifts subsequent sections down by approximately one row rather than compressing them.
- Every bottom capture includes all General settings and their state-specific copy: disabled, enabled, waiting, failure, and manual. The long failure message stays within the card. Show in Finder, recording controls, and all shortcut labels remain visible. Their positions match the corresponding before bottom views.
- Cropping a preceding permissions row at the top of a bottom screenshot is consistent with its scrolled framing, not an internal row-layout defect.

## Scope

The five named states vary the update settings; the permissions presented in this capture set are consistently Screen Recording allowed, Microphone allowed, and Camera not allowed yet. These images establish that layout only. They do not establish permission-request behavior, other permission states, scrollbar behavior, or interactive scroll reachability. The implementing agent reports separate behavior verification of scroll reachability; that evidence is outside this screenshot-only critique.

Final visual verdict: **no blocking visible defect found**. The intended camera row is legible and the lower content is preserved in the supplied bottom views. No clipping, lost controls, overlap, or contrast regression found. The initial-view continuation cue remains a low-severity discoverability observation, separate from functional reachability.
