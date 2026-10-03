# Service presence choices

## Sound — high confidence

### Retry a tiny failed picture through successful cache publication

The test imports three physical segments: occupied source, a gap, then occupied
source again. The first picture request reaches the real worker boundary with
both available intervals and receives an explicit retryable offline failure.
An explicit job retry succeeds with authored picture receipt values and small
fixture bytes. Reading those bytes through the public artifact delivery proves
that presence checks still admit, publish and expose the expected result.

The task specified the tiny source layout and read budget but left successful
publication coverage unspecified. Reusing the same fixture for a real retry
covers the cache's reserve and both publication checks without another harness
or production seam. The synthetic receipt belongs to the existing worker edge;
it proves service semantics, not native picture decoding. Verdict: sound.
Confidence: high.

### Damage detail after publication, then delete the asset row

After the picture is ready, the test makes one scratch segment's JSON invalid.
Replaying the ready job must preserve the recorded result because its owner is
still present; requesting source inspection must refuse the damaged detail.
Deleting the asset header then makes job retry return the exact existing missing
asset error without changing any job or attempt.

The task required corruption and deletion semantics but left control ordering
unspecified. Applying damage after publication separates source validation from
presence without weakening either path or adding an execution barrier. All edits
are confined to the test's scratch catalog. Verdict: sound. Confidence: high.
