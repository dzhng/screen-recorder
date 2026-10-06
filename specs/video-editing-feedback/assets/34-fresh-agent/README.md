# Fresh-agent delivery identity gate

The [fresh-delivery checker](../../../../skills/yap/scripts/fresh-delivery-check.mjs)
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

The full slice remains open until an installed public-CLI workflow produces real
media, discovers and repairs the planted speech defect, and supplies the native,
visual and audio evidence required by
[34-autonomous-trailer-acceptance.md](../../slices/34-autonomous-trailer-acceptance.md).
