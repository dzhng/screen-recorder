# Bounded managed-project history

The public history query passes its scoped cardinality check. Across three
alternating fresh-service trials at 5,000 and 10,000 revisions, cached 250-row
first/middle/last pages have p95 latency between 1.89 and 2.12 ms. Doubling history
produces a 1.001 median sampled resident-peak ratio and a 0.998 resident-growth
ratio. The largest serialized page is 87,873 bytes. These are observations on
this host, not guarantees for arbitrary revision-document sizes.

The harness creates every revision through the real ProjectStore using small,
fixed-size canvas edits. SQLite backup transfers those real catalogs to isolated
disk-backed services. Public CLI/MCP then walks complete revision identities and
documents, appends a real edit while paging, and proves the existing cursor
excludes it while a fresh history includes it. Restarting after that functional
walk keeps authoring and full-history traversal out of the fixed-page memory
measurement. The repeated query work uses the same three page positions from that walk.

An isolated Node module-load hook removes the SQL upper-ordinal condition. The
public continuation oracle fails on the newly appended revision. The hook never
changes production files; the successful run uses ordinary modules. Both seed
catalogs, complete expected revisions and reports are retained for the passing
and mutated runs in `evidence.tar.xz`. All sixteen members were verified against
`archive-hashes.json` after compression. `verification.json` contains compact
trial values and the final harness identity.

The first setup attempt used the wrong scratch-library permissions and was
refused before serving requests. The harness now creates that directory with
the service's existing private-directory contract. Its failure report is kept;
it is not a history-query failure. All final success and mutation service homes
are removed after shutdown, while the portable seed evidence remains retained.

Independent Codex review found no actionable defects; its attempted execution
was blocked by sandbox socket permissions. The actual host runs above exercise
the real service. A final measurement uses 100 repetitions per page position
and records 24–25 RSS samples per trial, increasing observation coverage over
the preliminary 20-repetition run. The sampling interval is 20 ms plus command
overhead, so it does not establish an instantaneous process peak or total system
memory. No media decoding, asset retirement, package history, installed-app
cutover or full-project memory result is claimed.

Run `packages/test-harness/editing/history-scale.mjs` with an explicit fresh
`--out` directory after building the CLI/service. It writes the seed catalogs,
expected revision records and measured report; it does not require media or
model inputs. The [slice](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/24r-history-query-scale.md) owns the gates.


A second read-only review requested a performance sensitivity control. A separate
isolated hook removes SQL `LIMIT` while retaining correct returned pages. All
pagination assertions still pass, but the unchanged memory gate fails: resident
growth rises by 2.437x when history doubles. The ordinary implementation is then
confirmed again at 0.998x peak and 0.966x growth. Neither fixture nor thresholds
were enlarged or relaxed to produce these outcomes. Both control datasets and
complete reports are in the same verified archive; hook/log files are adjacent.
