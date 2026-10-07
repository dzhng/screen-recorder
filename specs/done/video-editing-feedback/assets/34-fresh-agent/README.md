# Fresh-agent delivery identity gate

The [fresh-delivery checker](../../../../../skills/yap/scripts/fresh-delivery-check.mjs)
owns the reusable boundary between a consumer's delivery receipt and slice-34
acceptance. It reads two agent-produced runs: one from a clean managed root and
one from a relocated root. Both runs must retain the same brief, source bytes,
selection, recipe and byte-exact delivered artifact. Delivery must stay inside
the managed root, while source files remain regular external inputs and are never
overwritten.

The checker is deliberately narrower than a complete trailer workflow. It does
not decode a movie, run first-party models, inspect picture or audio, or accept a
human watching/listening result. Receipts must therefore mark native, visual and
audio coverage `unverified`; claiming those checks here is rejected. The focused
test creates scratch files and proves success, changed-delivery refusal and
visual-coverage overclaim refusal:

```sh
node --test packages/test-harness/editing/fresh-delivery-check.test.mjs
```

The historical acceptance gate was intentionally narrower than a complete
workflow. The retained media-aware replay supplies the concrete fixture route;
native, visual, and audio limitations remain explicit in the archived rationale
([README](../../README.md)).

The media-aware replay now supplies that concrete fixture workflow. Run it with
the already prepared first-party model and frozen native worker:

```sh
YAP_NATIVE=/absolute/path/to/yap-native \
YAP_PARAKEET_MODEL=/absolute/path/to/parakeet-tdt-0.6b-v2 \
node packages/test-harness/editing/autonomous-media-replay.mjs --out /fresh/evidence
```

The retained receipt records the run's hashes, the exact focused launch/podcast/teaser
references selected by the skill, and coverage without copying source movies or model
files into Git. The global synchronization and long-form speaker continuity gates remain
separate and are not inferred from this replay.
