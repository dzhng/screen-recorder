**No blocking extraction or provenance issue remains for this retained checkpoint.** The completed verification closes the previous compressed-WAV gate.

I checked stored sizes, all small-file and metadata hashes, archive membership, and manifest/report identities. They agree. The restore script correctly streams ordered volumes, preserves four-byte sample words, restores prefixes and repeated inputs, and rehashes all four materialized files. The retained verification reports the expected full WAV hash and four restored originals.

Two minor robustness issues remain in [restore.py](/Users/david/.codex/worktrees/noise-prepared-output/screen-recorder/specs/agent-editing/assets/24f-learned-scale/restore.py):

- Integrity checks use `assert`; run without `-O` or `PYTHONOPTIMIZE`. Explicit failures would prevent accidentally disabling verification.
- Failed extraction can leave partial outputs. Only accept outputs after successful completion; retries require fresh output paths.

Neither undermines the recorded successful verification. Verified temporary restore copies can be removed; no further numerical run is needed. This preserves independently generated evidence—it does not constitute a new oracle comparison. Original scope limitations remain unchanged.