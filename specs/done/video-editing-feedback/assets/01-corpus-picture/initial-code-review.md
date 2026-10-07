The retained media verifies successfully, but the new CLI derivation path cannot successfully derive a video fixture because it immediately runs the certification gate that the derivation deliberately leaves pending.

Review comment:

- [P2] Keep video derivation separate from certification — /Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:500-506
  When the CLI derives a new video case, `deriveCorpus` intentionally records `preservation.status` as `unverified`, but execution falls through into `verifyCorpus`, which rejects that status with `PRESERVATION_UNVERIFIED`. Thus `derive ...` exits with an error after writing the fixture instead of returning the pending derivation; return the derivation result and leave certification to the separate `verify` command.