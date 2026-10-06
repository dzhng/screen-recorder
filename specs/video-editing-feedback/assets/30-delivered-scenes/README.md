# Delivered scene inspection

The portable checkpoint is implemented by
[`skills/yap/scripts/delivered-scenes.mjs`](../../../../skills/yap/scripts/delivered-scenes.mjs).
It accepts a committed export, verifies the selected file remains the same regular
file while it is read, imports that exact path through the public asset lifecycle,
reads existing source-scene observations, and reads authored project events in a
separate request. The report maps delivered source timestamps to project time and
associates nearby video joins as evidence only. Audio cuts, authored joins and
detector coverage remain separate; no edit is authorized.

The focused receipt uses deterministic public-operation doubles to exercise the
contract without inventing a second scene detector or requiring native media in a
portable checkout:

```text
bunx vitest run skills/yap/scripts/delivered-scenes.test.mjs
4 tests passed
```

This does not close the slice's native checkpoint. A future pass still needs a
real export → import → scene-read run with planted flash/gap and deliberate hold
controls, plus delivered-pixel comparison and an unprimed visual critique.
