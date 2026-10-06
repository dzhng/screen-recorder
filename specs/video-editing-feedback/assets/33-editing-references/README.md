# Slice 33 reference-routing checkpoint

This checkpoint separates launch/demo, podcast/interview and teaser/episode
cold-open guidance into focused skill references. `video-use-cases.md` is now a
short router; shared assembly and rendered-output checks remain owned by
`creative-workflows.md` and `editorial-checks.md`.

The references carry the frozen workflow decisions from FEEDBACK and the
retrospective:

- capability discovery is the first workflow question; available tools are used,
  missing external capabilities are recommended only when the brief materially
  needs them, and default installs/accounts are avoided;
- launch work proves one promise, studies reference audio and picture instead of
  guessing a mood, preserves full content unless cropping is requested, and
  retains external asset recipes for clean replay;
- podcast work preserves complete exchanges, declared raw/session clocks, mixed
  recording speaker uncertainty and explicit caller labels, while dialogue levels
  and delivered picture/caption quality are checked automatically;
- teasers inspect the full exchange and may end immediately after a complete
  provocative question before its answer, keeping the withheld answer out of all
  surrounding graphics and preserving truthful context.

No product media capability is invented here. The pass changes routing and
workflow guidance only; native execution and external asset availability remain
evidence-backed per task.

Focused checks:

- all three new references are linked from the use-case index;
- the question-end strategy appears only in the teaser reference and its index
  pointer, avoiding duplicated launch/podcast rules;
- capability-first discovery and no-default-install policy point to the existing
  capability-discovery owner.

The case-selected [use-case routing helper](../../../../skills/yap/scripts/use-case-routing.mjs)
is the fresh-agent checkpoint for this slice. It reads the installed reference
bytes, verifies that each focused file is linked from the index and retains
portable SHA-256 identities plus the shared no-human-QA/external-capability
policy. The [routing receipt](routing-receipt.json) was generated for launch,
podcast and teaser. The corresponding model-eval cases are retained in
`evals/cases.json`; this checkpoint does not claim media editing, caption/music
interchange or native delivery.
