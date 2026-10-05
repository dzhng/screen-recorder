# 07 — Bounded Library browsing and actions

Status: backend paging/fencing in progress; window binding TODO.
Dependencies: 03, 05 for presentation binding. The bounded recording-page owner
is independent and may be implemented/tested before the new view/window exists;
all final saved-media reachability and visual gates still apply.

## Contract

Unlock complete saved-recording page navigation in the independent window, preserving exact existing actions. The question is truthful breadth with fenced asynchronous reads.

## API seam and ownership

Extend the existing LibraryController/LibraryState with a typed recording cursor using beforeSequence, separate from the project's afterSequence cursor. Follow existing bounded page/generation/previous-page ownership; retain the existing five-item page bound unless measured view requirements justify another bounded value. Render current-page source admissions, project pages, tracked/unfinished Exports and aggregate storage from their current owners. The page filter is explicitly labeled Filter this page and applies only to displayed items; clearing it reveals that page again. No global search/backend or full export-history crawl. Reopening Library retains tab; navigation clears page-local filtering to avoid hiding a newly loaded page.

Consume the presentation-independent recording titles/status retained in 05, including the title captured for a deletion request. Preserve ExportMenu's existing action applicability and status/path formatting in the export presentation owner, consumed directly by Library and its checks; retire the menu-row builder and update consumers without aliases. Transport/recovery remains in ExportsState and its controller, not in the view or formatter.

## Runnable or reviewable artifact

A fixture/service test has more than one page of recordings/projects, an inserted newer take, source-publication failure, unconfirmed deletion and export cleanup/request recovery. The native window makes every existing saved-media action reachable. Exports subtitle states tracked deliveries and unfinished recovery; it does not promise all historical files.

## Verification and what stays green

Test first in library-controls.test.mjs and the relevant deletion/preview/export controls suites. Verify forward/back recording pages, distinct cursor kinds, inserted newer take excluded from continuation, wrong/nonprogress cursor refused, delayed page after navigation/delete/service replacement fenced, last-good rows retained on failure, visible-page source admission updates, exact target on delete retry, and filter does not imply searching hidden pages. Preserve pinned project preview/export and resend/retry-export/retry-cleanup/abandon/reveal/dismiss distinctions. No recording becoming ready creates a project. New view owns no polling loop; source/status reads do not grow with complete catalog size.

## Visual variable and crop

Saved-item status/action legibility: complete recording source-details row, project action group, export failure/cleanup group and page/filter controls. Compare representative selected concept rows; sample data is excluded. Outer geometry/appearance are fixed by their owning slices.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

Button placement within approved row hierarchy and internal paging implementation are delegated. Use native source icon fallback when truthful thumbnails are unavailable; no thumbnail preparation pipeline. Rename misleading recent/menu-derived helpers when all consumers change, rather than retaining aliases. Keep existing original-source and aggregate-storage meanings.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
