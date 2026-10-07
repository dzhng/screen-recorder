# Player-oriented picture reference

The accepted observation space is **opaque sRGB RGBA8 after applying the image's
actual embedded profile and the track's preferred orientation**. The production
source/project executors and the player-oriented reference are separate routes;
[the durable runner](../../../../../packages/test-harness/editing/decoded-picture-replication.mjs)
compares their complete oriented rasters through public CLI/MCP delivery.
Its `--help` owns invocation and case selection. It requires the pinned diagnostic
FFmpeg tools and an explicitly supplied native build; it prepares no models.

[Accepted samples](accepted-samples.json) retain the camera/chart measurements.
[The durable rotated run](durable-rotated-report.json) adds an orientation-only
control. Every public physical sample is compared as an exact rational against
the player's actual timestamp; rounded microsecond labels do not prove membership.
The tolerances were frozen before this acceptance: RGB mean absolute error at
most 1/255 and maximum channel delta at most 2/255. They admit measured independent
SDR rasterization differences, not missing frames, changed geometry or profile
substitution. This is sampled unchanged-picture proof, not all-frame playback,
HDR acceptance, motion quality, or a grade/style judgment.

Source declarations and decoder-generated image profiles are separate evidence.
The tested cameras declare BT.709 transfer/primaries/matrix, limited range, square
pixels and no rotation. The historical asymmetric chart has absent declarations;
its actual generated profile is retained rather than assigning missing tags from
that profile. [Metadata and profile identities](accepted-samples.json) pin the
observed scope. Existing native color admission continues to own broader rejection;
this checkpoint does not loosen it or establish untested profile parity.

Plain FFmpeg RGB and profile-aware reading of its PNG are **two diagnostics**;
neither is interchangeable with the player appearance. The report preserves both
measurements and the actual profiles. The supplementary comparison montages show
stored RGB at reduced scale and strip profile metadata; judge color quantitatively
with the independent profile-aware observer and inspect original PNGs for display.

[Read-only replay](replay.mjs) checks frozen report identities, exact clocks, profiles,
retained metrics and representative-file hashes; it does not remeasure missing
pixels. Use its `--help` for case selection.

[Shots](shots.json) pins the retained native-size representative pictures and
supplementary comparisons. The remaining sampled image hashes/metrics are retained
in the reports; those unretained images require the durable runner to reproduce.
No model, app bundle, mutable build output or duplicate original video ships here.
The existing chart fixture and certified camera corpus remain their own owners.

The [failed first attempt](failed-orientation-preparation.json) stays failed: its
FFmpeg metadata option did not author rotation. Its four camera/chart cases remain
valid scoped measurements. [Corrected scouting](corrected-orientation-scout.json)
and the durable rotated run use input `-display_rotation 90` with stream copy;
exact chart/control hashes are pinned in the runner. Aggregation does not turn the
failed whole run into a pass. [Verification](verification.json) and
[visual review](visual-review.md) state the final acceptance limits.
