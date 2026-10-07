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

The portable receipt does not close the native checkpoint; the retained native
run below covers the delivered export/import/scene-read path and visual review.
The separate [`native/empty-edit`](native/empty-edit/README.md) receipt now
covers a physical empty edit through source coverage, project still delivery
and committed export; declared acquisition holes remain separate.

## Native delivered-export checkpoint (2026-10-06)

`native/` retains a real macOS run of the case-selected helper against a
committed H.264 export. The runner imported the exact export bytes through the
public asset lifecycle, waited for native scene observations, and passed those
rows to `deliveredScenes` alongside separate authored video cuts. The retained
export digest is `977bea24eac862b56317c08ee05ab06fd989fe8972a189a0f4e4ddbadb02737d`;
the native worker digest and complete report are in `native/report.json`.

Observed scene boundaries were `1.000s`, `1.200s`, `2.600s` and `3.200s`.
The first pair brackets a planted flash; the `1.200s–2.500s` interval is the
declared visual gap control; the `2.600s–3.200s` interval is a deliberate hold.
Authored video joins at `1.000s` and `2.600s` matched only those delivered
transitions. The `3.200s` hold-end transition remained observed evidence and
was not turned into an edit. The export hash was checked before and after
inspection and remained unchanged.

The five retained PNGs are the visual review set (`frame-01`, `frame-06`,
`frame-10`, `frame-14`, `frame-20`). A fresh inspection found no clipping,
framing or decode artifact; the solid-color fixture makes the planted
boundaries unambiguous. The repository compare helper was invoked but could
not run because this checkout lacks its optional `pngjs` dependency; the
native report and direct frame inspection are retained instead.

The retained native report is replayed by
[`scene-delivery-replay.mjs`](../../../../packages/test-harness/editing/scene-delivery-replay.mjs).
That checker binds the planted flash, gap and hold times, the detailed delivered
scene rows, authored video joins and their association, source preservation,
committed immutable export and its hash without rerunning a detector. It protects
the evidence receipt; broader delivered-scene parity and visual review remain
separate gates.
