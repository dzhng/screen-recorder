# 24z5 — Service asset presence

Status: asset presence checks at job admission and disposable cache ownership use
the existing boolean catalog owner. The [evidence packet](../assets/24z5-service-asset-presence/README.md)
retains consumer proofs, original diagnostics result, source pins and limits.

## Presence does not reconstruct source detail

The service must refuse work for an absent asset before admitting a job or
reserving a cache file. Those checks need the asset row's existence; they do not
consume physical segment metadata. [Service wiring](../../../apps/service/src/project-service.ts)
uses [AssetStore.has](../../../packages/core/src/assets.ts) and preserves the
existing missing-row error code, message, details and retryability. No new
require wrapper, provider, public API or persistent cache is added.

Source selection and frame receipt validation still consume detailed metadata.
An asset whose segment JSON is damaged remains present for owner checks, so an
idempotent replay of its ready job stays readable. A fresh source request still
refuses the damaged detail. This deliberately removes incidental parser failures
from presence checks; it does not repair damaged source metadata or guarantee
physical file existence. Deleting the asset row still refuses a retry without
changing recorded jobs or attempts.

## Consumer proof and acceptance

The [public service regression](../../../apps/service/src/project-service.test.ts)
uses an authored occupied/gap/occupied source. It observes real catalog work while
checking complete source options, the actual worker request, recorded failure,
successful retry/cache publication and delivered bytes. Corruption and deletion
controls distinguish source validation from owner presence. The packet owns the
bounded-read counts and unchanged diagnostics deadline result. Root owns shared
handoff and integration; no general latency or timeout-cause claim follows.

[Root integration](../assets/24z5-service-asset-presence/merged-verification.json)
adds the full service suite and actual public WAV lifecycle on the merged
metadata/binding producer. Historical child source identities remain unchanged.
