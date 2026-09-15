# Planning review record

This is evidence of specification review, not product validation.

## Work performed

- Read the discovery map and full conversation decisions.
- Independently drafted minimal, risk-first and seam-focused plans; the seam draft
  consulted Claude Opus/high as a second model family.
- Inspected factory/photoctl manifests and guidance plus installed Apple SDK headers.
- Synthesized one architecture, split broad native/evidence gates, and assigned each
  concept a single owner.
- Three agents reviewed the materialized contracts/slices. The following findings
  were resolved before handoff.

## Resolved findings

1. Revision compare-and-swap applies to edits, not pre-revision capture/model setup.
2. Request replay is durable and checked before stale rejection; undo never revives IDs.
3. Protocol declarations do not import core handlers; service composition binds them.
4. Pre-capture allocation has preparing state and explicit failed-start outcome.
5. Recovery preserves video and independent audio intervals instead of truncating
   everything to the shortest optional track.
6. Scene boundaries are produced in trail work and consumed by index selection,
   removing the dependency cycle.
7. Bootstrap is separate from actual-client image proof, so a pending login doesn't
   block unrelated native/model work.
8. Preview/export menu actions are wired only when their respective slices ship.
9. Raw cursor, events, history and search have explicit pagination limits.
10. Dependency-waiting exports hold no heavy-worker slot, avoiding queue deadlock.
11. Portable packages retain source scene boundaries and policy provenance.
12. Two-second trail default is not delegated away as a styling choice.
13. Zero-width cuts and undo exhaustion have explicit outcomes and an undo example.
14. All named feasibility gates may trigger technical reslicing; no gate silently
    authorizes a product downgrade.

A focused recheck reported no remaining blocking specification issues. Local
Markdown-link and code-fence checks passed after materialization; these checks
must be repeated after final edits. Native recording, speech fidelity, actual-agent
image inspection, media editing and recovery remain implementation acceptance gates.
