# Independent supplied-text timing case

The preserved Qwen MPS/float16/English candidate returned all five supplied words
in order with valid spans. Independent manual timing measured 30ms median and 40ms
p95/max, compared with saved ASR 40/160/160ms. Three edge observations improved,
seven stayed unchanged and none regressed. Those three changes represent only two
distinct human times; the ten observations are correlated. The unchanged full
evaluator remains **pending**, and parent 12 remains open.

[Verification](verification.json) binds complete requests/results, actual child
terminals, executed sources and private scoring. The whole-source format bridge
preserved all 71508 samples exactly as Int16/32768 at 44100Hz, with no unavailable
support. The existing finite converter produced 25943 mono16k frames, rather than
saved ASR 25944. The declared 59.099us terminal difference stays explicit; neither
padding nor a timestamp correction was applied, and internal ASR PCM equality is
unknown. No engine-only cause or generalization follows from this comparison.

All three children and the producer exited zero. The observed 3478487040-byte peak
RSS meets the inherited 4GiB criterion for this case, with no isolated performance
or general capacity claim. Original model/runtime/source/result authorities stayed
unchanged. The case copy restores only two float16 literals in the current generic
entry and consumes its byte-identical shared inventory owner. The actual receipt
contains all eight model files; the original 12i empty receipt and producer failure
remain untouched. Older historical Python/wheel binary identities remain unknown.

The [fixed executed plan](fixed-plan.md) retains the pre-dispatch source identity;
the [leaf](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/12l-independent-supplied-text-timing.md) records completion.
No production or maintained measurement owner changed. [Review](review.md) and
[choices](choices.md) describe the limited evidence and process ownership.

Licensed media and full human/scoring rows stay in the private outside-Git
research directory named by verification. Full signed edge rows are retained there
for every comparison; Git contains our executed producers, model result and
aggregate metrics, without redistributing corpus annotations or audio. Coverage,
audition, filler and model-training exclusion claims remain separate. No additional
conversion, inference, retry, preparation/download or adoption is authorized.
