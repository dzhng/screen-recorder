# 24z9 implementation choices

## Sound

### The existing recipe helper consumes normalized frame options

When an agent asks for a source screenshot index, the frame owner already resolves the selected source and normalizes its frame options. The private recipe helper now consumes those options to construct the same encoded recipe, instead of looking up the source a second time. When the queue later executes the job, it resolves a new plan and uses that plan for both the recipe check and complete materialization support.

The task specified call-local reuse but left the helper argument unspecified. Taking the frame owner's existing options type avoids a new facts wrapper, optional plan parameter or compatibility branch. Future private callers must obtain fresh authoritative options; portable adoption keeps its distinct retained-recipe validation. There is no public API or persistent cache.

When: 24z9 owner correction. Verdict: **sound**; exact recipe checks and both read regressions agree, while execution preserves its own resolution. Confidence: **high**.

### Use cancellation to bound the executor diagnostic

To count execution's metadata reads, the diagnostic invokes the real queued job through the public executor with a signal that is already canceled. Current execution validates its recipe and source before reaching cleanup's cancellation check. The observer therefore counts the synchronous planning work without mocking a private method or adding instrumentation to production. The queue is then released normally, and the complete output/delivery oracle verifies ordinary execution too.

The task requested an outer-consumer SQLite observer but did not prescribe how to isolate the executor phase. This choice explicitly pins error precedence and the existing cancellation boundary; it does not treat the diagnostic as a normal queue run or a timing result. If cancellation is intentionally moved earlier in a future contract change, this diagnostic must move with that contract.

When: 24z9 execution proof. Verdict: **sound**; target-order and full-support falsifications make the acceptance seam meaningful, with separate normal lifecycle verification. Confidence: **high**.

No unsound or needs-user choices remain. Previously banked metadata/frame authority decisions are referenced rather than audited again. Internal names and evidence packaging follow the scoped task.
