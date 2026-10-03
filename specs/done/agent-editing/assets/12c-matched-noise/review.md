# Independent numerical review

Read-only Codex review confirmed frozen recipes and compensation, matched-input
construction, all twelve retained audio hashes, scalar measurements and 4,000
energy windows. It checked executable/source/driver identities, both scratch
reports and seeded hum/hiss generation, float32 mixing and the 960-sample RNNoise
selection. Initial and confirmation files agree exactly. The reviewer did not
rerun inference, build, download or play audio.

No actionable defect was reported. Noise-only attenuation is neither speech
quality nor separated residual noise; all study/spec language retains that limit.
Shape review keeps both frozen recipes unchanged and one comparison harness,
without a production dependency or new state policy. The comparison inputs are
research discretion, not a user-facing default. No new architectural choice is
introduced by this numerical evidence pass.
