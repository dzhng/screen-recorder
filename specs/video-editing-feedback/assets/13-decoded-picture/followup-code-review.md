Finding:

- [decoded-picture-proof.test.mjs:38](/Users/server/dev/yap-video-editing/packages/test-harness/editing/decoded-picture-proof.test.mjs:38) does not independently test either new invariant. Its non-sRGB fixture also uses `sourceProfileSHA256: "unrelated"`, so the test can pass solely because the ICC hash is rejected. It would still pass if the profile-name checks were removed. Split this into:
  - non-sRGB profiles with the frozen valid hash;
  - sRGB profiles with an invalid hash.

The production fixes themselves are consistent: the validator enforces observer/PNG sRGB plus the frozen ICC hash, replication compares the reference’s encoded profile and hash with the independent reader, and the README links to `verification.json` and `visual-review.md` are correct. No other concrete bugs were found in the requested scope. No tests or media runs were performed.