# Fresh package and fade skill use

A fresh GPT-6-luna agent used the product skill, public CLI/help and delivered
media to export a two-second split-fade project, open/adopt an independent copy,
dim its second half, inspect it and export video. The input's original normalized
fade clock spans both clips; preserving the split evaluation ranges is essential.
The agent's final edit keeps that curve and adds clip opacity 0.5 to the second half.

Root independently verified the original project head is unchanged, the copied
project's final revision is current, and its export receipt hash matches the
actual file. Eight direct native PNGs exactly match separately authored constant
opacity controls: time/2 seconds for the first half, half that value for the second.
The four first-half frames also match the donor byte for byte. Fresh visual review
of all 20 originals and the comparison sheet found matching groups, stable geometry,
an initial black image, and the same brightness drop at the requested midpoint.
Stills do not establish motion smoothness, audio or general encoding quality.

The actual pinned exported revision is `8c90de56-b001-4920-9d20-8b96d054daab`.
The current copied revision `3c3559c1-ba7d-44f3-ad88-c237adb7350e` restores that
same document. The agent's written summary incorrectly typed other revision IDs,
including `ba01` in place of `b001`; saved requests and export receipts are the
source of truth. This is a handoff error, not lost project state, and the skill
already requires programmatic reuse of opaque IDs.

The agent also tried final-output opacity and received an unsupported transparent
H.264 export; it restored the valid clip edit. It reused an existing batch-output
directory and received EEXIST before delivering to a fresh directory. Those
failures and recoveries remain in `consumer/`. The skill now explicitly polls without an output destination until ready, then
delivers into a fresh directory. A second fresh GPT-6-luna trial followed that
workflow through a pending batch, a ready poll and one successful five-image
delivery, with unchanged project head. Its complete receipts are retained in
`inspection-consumer/`; the first trial's errors remain part of the evidence. The agent's movie brightness ratios are not the acceptance
oracle: root's independent constant controls verify the exact direct PNGs.

`consumer/` retains all original requests, responses, package, media and inspection
outputs. `examiner/` retains independent public receipts and 20 PNG captures;
`examiner-source.mjs.gz` freezes the executed probe. No installed app or real user
library was touched. This asset-only skill trial does not close retained acquisition,
model-output or font dependency portability in slice 22.

Large help/trace receipts are gzip-compressed without changing their bytes;
`compressed-receipts.json` retains uncompressed hashes and `sha256.json` pins all
retained files. Compression keeps large generated schemas and traces available
without making them the human review surface.
