# Source lifetime choices

- Keep generation reclamation and whole-recording deletion as distinct lease scopes. Source work inherits both and native removal retains exclusive root authority; neither scope is inferred from process-local job state after restart.
- Reuse the existing recording-directory exclusive admission before destructive deletion work; do not teach recursive removal to infer active descendants.
- Extract the inode-checked directory lease to the existing file owner only after acquisition and source processing both consume it. Keep domain-specific busy outcomes with their callers.
- Reclaim unrelated abandoned generations in the same bounded pass, then surface the busy generation. Explicit retry after native exit makes progress; no automatic partial-prefix retry is added.
- Preserve missing-root deletion recovery and native private-directory admission; update the public fixture's directory mode rather than relax that contract.
