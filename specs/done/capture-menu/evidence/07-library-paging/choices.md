# Backend pass choices for the feature ledger

All entries are sound. Review the medium-confidence restart decision first.
The remaining paging details were explicitly delegated by slice 07; they do not
add a new product contract, service operation, dependency or persistent state.

## Service replacement restarts page navigation while retaining last-good rows

- **When:** Library paging backend pass.
- **Choice:** If the service is replaced while the user browses an older recording
  page, its old cursor history is cleared. The last readable rows remain visible
  until a first-page answer arrives. If that answer fails, those rows and the
  failure remain visible, with no invented next/previous cursor. A cursor is the
  sequence boundary the service uses to find another page. Keeping that old
  boundary after replacement could navigate through a different catalog as if
  it were the same one.
- **Gap:** The plan required replacement fencing and last-good rows, but did not
  say whether recording page history survives replacement. The existing project
  owner already restarts its history.
- **Reach:** Replacement refreshes both tab catalogs from their first page; the
  future window can preserve its tab independently of catalog navigation.
- **Verdict:** Sound. A new service's first successful answer establishes the
  new catalog while retaining useful evidence on failures.
- **Confidence:** Medium. This follows existing project behavior; preserving
  recording page history under a proven same-catalog identity could be a future
  product decision, but no such identity contract exists today.

## A new visible-page generation can read preparation jobs immediately

- **When:** Library paging backend pass.
- **Choice:** Suppose an old page is waiting for a preparation-job answer and the
  user opens another page. The new page may read its own jobs immediately. The
  old answer cannot update those rows or release the new page's read gate. A
  generation is a locally unique observation identity: only replies carrying
  the current identity can affect the page. Keeping the old busy flag would
  freeze current-page progress until that obsolete request finally settled.
- **Gap:** The plan required fenced delayed reads and visible-page admissions,
  but did not specify ownership of the existing preparation-read busy flag.
- **Reach:** Paging, deletion and catalog refresh use the same recording
  observation identity. Reads remain bounded by the visible page and the
  existing cadence; the window adds no polling loop.
- **Verdict:** Sound. The red test reproduced current-page starvation; the new
  generation owns both the updates and its busy flag.
- **Confidence:** High.

## Recording cursor admission follows the existing project boundary

- **When:** Library paging backend pass.
- **Choice:** A recording page must carry its existing nullable next cursor.
  Its numeric boundary must be positive and, for a continuation, older than the
  requested boundary. A project cursor or missing cursor is a read failure,
  retaining the current rows and navigation. The alternative of treating an
  unreadable cursor as the last page would silently hide available recordings.
- **Gap:** The spec required typed cursor progress validation, but did not spell
  out failure behavior for an absent response cursor. The shared service schema
  always supplies that field, including null for a last page.
- **Reach:** The native reader stays aligned with the current service contract
  rather than adding a compatibility fallback. It does not create another
  recording ordering model or change the service API.
- **Verdict:** Sound. Malformed cursor regressions and progress falsification
  failed for the expected reason before the production admission was restored.
- **Confidence:** High.
