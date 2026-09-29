# Source-evidence retry evidence

The actual native journal permission regression is retained as red/green. The
public recording processing journey proves explicit retry of journal and canonical
read failures, retaining recording/source/job identity and source bytes. Corrupt
canonical media remains nonretryable. Native direct export separately proves
canonical access restoration and definitive proof-identity conflict.

Recording processing retries read the recording-owned source afresh per attempt;
they do not replace a frozen acquisition/import descriptor. The service test proves
that an admitted descriptor's changed ctime remains SOURCE_CHANGED even after chmod
restoration. Its subsequent success explicitly supplies a freshly admitted identity.

The production change is confined to source-export read/error boundaries. No new
persistent format, lifecycle, retry loop, maintenance target or physical capture.
Raw reports/scripts and compressed logs preserve the finite evidence. Initial
scratch setup failures (an invalid preparing→complete fixture transition and an
incorrect assumption that chmod preserves identity) were corrected as test errors,
not counted as product reds. Parent20d's remaining-gates proposal is retained.

Independent review found an O_NOFOLLOW symlink refusal mislabeled operational;
the retained actual red/green fixes ELOOP/ENOTDIR at the journal read owner. Final
review has no actionable findings. The implementation run passes all 24 native
source/recovery tests, the default capture suite and service type checks. The
reviewer's sandbox blocked two sysctl memory checks; the unsandboxed implementation
run passed them, and both logs preserve that distinction. Removing the service IO
translation made its regression fail; restoring it passed.

The fixture source is already retained under
`../20d-activation/controller-final/take` (decompress the journal for replay).
`source-identities.json` records its raw member hashes. Scripts retain exact setup,
CLI requests and assertions; absolute scratch paths identify their original run.
The final worker hash identifies the matching public and native report runs.
