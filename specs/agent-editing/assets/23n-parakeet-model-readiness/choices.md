# 23n choices audit

No unsound or user-only choice remains. Model/revision/runtime selection, explicit
local adoption, preservation and the inference prohibition were fixed by the task.
Internal checker and storage names were delegated.

- **Current source bundles — sound, high confidence.** An older saved service can
  describe earlier behavior. This pass emits the current production service/CLI
  into owned persistent storage and pins every actual bundle input, including
  resolved paths. All workspace inputs belong to the owned worktree. The frozen
  native worker is unchanged and executes only its startup capability request.
  This keeps 23m's readiness prerequisite tied to the current registered owner;
  it does not select another speech runtime.
- **One complete preservation snapshot — sound, high confidence.** The checker
  hashes original registered bytes and records file identities, modes and links
  before and after. Both snapshots compare equal. The archive keeps one complete
  before snapshot and the after fingerprint/equality result; an identical snapshot
  from the failed discovery fixture uses that same byte authority. Compact JSON
  snapshot fingerprints and exact archive-member hashes have separate meanings.
  This retains the proof while avoiding duplicated inventories; no original file
  or failed report is rewritten.

The missing source was acquired with the installed HF CLI at the exact registered
revision, then public model.prepare performed managed adoption. No alternate
downloader, registry, model, preparation owner, fabricated receipt or inference
path was introduced.
