# Descriptor-backed native inspection

The [shared media input owner](https://github.com/dzhng/screen-recorder/blob/443cd024a3dca1fac3eac82e1ee244816560fb52/helpers/mac/Sources/ScreenRecorderMediaTime/MediaInput.swift)
retains a duplicate of an inherited regular-file handle for the asset's lifetime.
Frame and audio consumers retain that owner, so closing or renaming the caller's
original file cannot switch their media. Ordinary paths keep the same AVFoundation
asset behavior. Selection, geometry, scene sampling, decoding and mixing remain
with their existing owners.

AVURLAsset cannot directly decode the tested `/dev/fd/N` URLs. A resource-loader
delegate serves positioned reads through a unique asset address. It yields after
every bounded chunk: AVFoundation first asks for an entire MOV, then cancels that
request and seeks metadata. A synchronous response loop delays the cancellation
and can retain the whole recording. No new decoder or media copy is involved.

## Resource and failure contract

Descriptor assets permit eight active resource requests, 64 KiB pump chunks and
64 MiB total bytes delivered during one asset lifetime. The cumulative byte ceiling
also bounds bytes handed to AVFoundation, whose internal caching is opaque. These
are limits for bounded inspection calls, not a full-movie streaming guarantee.
A valid but unusually large inspection can therefore fail explicitly with
`LIMIT_EXCEEDED`; it is never silently truncated. Short reads, changed file lengths,
invalid access and cancellation fail rather than substituting media. Loader errors
survive AVFoundation's generic error wrapping at the frame/audio boundary.

The loader retains no range cache. Its serial queue keeps request mutation ordered,
and queued pumps hold weak owner references. Native tests confirm that the duplicate
survives caller close/unlink and closes after owner retirement or cancellation.

PNG output writes the existing encoded bytes to a retained writable handle. WAVE
output uses the same AVAudioFile sink with an explicit WAVE type. Neither resolves,
renames or deletes an output pathname. These handles must designate caller-owned
private files: failed descriptor outputs may contain partial bytes, which their
context must discard. Ordinary outputs retain their existing atomic/staged sinks.

## Evidence

[Machine results](descriptor-media.json) record the actual worktree-owned native
build. Fourteen focused worker tests and the complete native frame suite pass.
The new tests compare PNG bytes with supplied pointer/trail overlays, whole WAVE
container bytes and decoded PCM after source rename/unlink and output rename.
They also reject an input/output handle alias and exercise the real delivered-byte
ceiling without publishing a partial ordinary WAVE.

The preserved thirty-minute recording is 109.21 MB. First, middle and late arbitrary
trail frames are byte-identical through ordinary and descriptor inputs; late visual
sample results are exactly equal. Its SHA remains unchanged. The four-request
worker peaks at 44.30 MB RSS through descriptors versus 28.90 MB through ordinary
paths; measured memory footprints are 90.51 MB and 79.10 MB respectively. These
results establish the generated workload's bounded behavior, not a raster-size-
independent memory promise. No full screenshot-index workload was run.

Independent Codex review found no actionable defects. Its environment failed on
ordinary-path native decoding before reaching descriptor checks, so runtime claims
come from the actual worktree build and the recorded focused/full-frame runs.

The retained package context owns admission, file identity, derivative budgets and
cleanup. It must keep inherited handles alive through native completion, discard
failed outputs, and drain workers before removing the workspace. Full-movie
rendering through inherited inputs remains outside this bounded inspection seam.
