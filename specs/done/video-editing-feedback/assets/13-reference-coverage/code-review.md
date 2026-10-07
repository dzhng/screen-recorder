Marker yap-reference-coverage-review-20261005

- **Not clean — `packages/test-harness/editing/FrameColorReference.swift:65-70`**: `outputProfile` now reports the requested `srgb` target, rather than the converted/encoded image’s actual color space. The receipt can therefore claim profile evidence without proving the output PNG carries that profile; current tests only assert the constant and transfer metadata.

- **Not clean — `packages/test-harness/editing/FrameColorReference.swift:68-70`**: Per-request failures now return status `failed` with process exit 0, but existing consumers still dereference `file` without checking status (`acquisition-picture-evidence.mjs:312-317,350-357`; `layers.mjs:208-210`; `layer-edit-motion-fixture.mjs:77-80`; `layers-native.mjs:382-388`). A failed sample becomes an indirect undefined-path failure instead of an explicit receipt failure.

- **Not clean — `packages/test-harness/editing/picture-reference.test.mjs:30-66`**: The new native coverage is absent from `packages/test-harness/package.json:9`, so the default test command never runs it.
