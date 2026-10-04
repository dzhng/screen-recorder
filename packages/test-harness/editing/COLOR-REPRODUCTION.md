# Native appearance and encoding loss

The [current appearance journey](encoded-appearance.mjs) separates native
source interpretation from the encoded roundtrip. Independent platform references
and decoded output keep a changed picture from being blamed on the wrong stage.

## Preserve interpretation before judging encoding

Missing color metadata is uncertainty. Assigning a presumed profile changes the
source interpretation; it is not neutral metadata repair. Native decoded
appearance is the experiment's reference, not proof of the creator's intended
profile. Respecting declared metadata and testing an explicit interpretation of
untagged footage are separate claims.

Core Image's [source color-space option](https://developer.apple.com/documentation/coreimage/ciimageoption/colorspace)
and [output color space](https://developer.apple.com/documentation/coreimage/cicontextoption/outputcolorspace)
control different stages. The runner retains source metadata and reference,
pre-encode and decoded output separately. Compare matched pixels over the whole
image: a few flat patches can pass while text and edge artifacts remain.

A bitrate improvement does not establish a universal encoding policy. Keep
conversion error distinct from codec loss, and interpret timing or memory only
within the measured workload. A first-frame experiment cannot establish sustained
throughput, wide-gamut fidelity or physical-camera accuracy.

## Evidence and reuse

The [frozen comparison](../../../specs/done/agent-editing/assets/06-color/report.json)
owns exact requests, measurements and the explicit-profile counterexample.
Its [visual review](../../../specs/done/agent-editing/assets/06-color/visual-review/README.md)
owns the perceptual judgment. The [declared-profile follow-up](../../../specs/done/agent-editing/assets/06-rec709/README.md)
retains matched writer and RGB attachments.

Historical producers are available through the [evidence source snapshot](../../../specs/done/agent-editing/assets/README.md).
Current runners own future regression checks; old results neither select production
output settings nor establish general appearance acceptance.
