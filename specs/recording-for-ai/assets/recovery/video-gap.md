# Empty video edit recovery

A generated MOV contains acquired video at `[0,300000)` and `[800000,1100000)`
microseconds, with an empty middle edit. Its edit list explicitly preserves that
absence. AVFoundation also emits a decoded padding sample at 300000us, so decoded
sample presence alone cannot establish acquisition.

Before the correction, recovery returned `[[0,1100000]]`. The red regression log
records that failure. The reader now applies the same occupied edit-list
intersection to both video and audio, then applies the additional audio journal
proof where available. It returns `[[0,300000],[800000,1100000]]` while preserving
1100000us as the take extent: gaps remain in time instead of being compacted away.

The native capture/recovery suite and the Node recovery worker tests pass. The
fixture independently checks its persisted empty edit and decoded occupied frame
timestamps. The source asset is retained while exporting the composition; an
initial fixture that retained only its track could not export reliably. Independent
read-only review found no concrete introduced defect. No visual fidelity or new
screen/audio capture claim is made by this metadata test.

The correction reuses existing intersection logic and adds no format fields or
new recovery mechanism. Full slice02 lifecycle and physical audio gates remain open.
