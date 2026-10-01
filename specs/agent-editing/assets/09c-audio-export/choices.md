# Audio export choices

All entries are sound. Review the medium-confidence storage tradeoff first; there
is no user-only editorial choice or permission gate in this implementation.
The [native ledger](../09c-native-audio-file/choices.md) retains the container,
presented-frame and streaming decisions delegated to that owner.

- **Medium confidence — encode the reusable full PCM file.** When a caller requests
  M4A after inspecting or exporting the same project mix, the encoder borrows the
  existing cached WAV and writes another cached rendition. It does not mix again
  or create a second audio engine. This costs temporary disk space and inherits
  the WAV size limit; an unbuilt direct-stream path could reduce disk use but
  would introduce another preparation/lifetime seam. The current decision follows
  the established owner and makes equivalent settings share actual work.
- **High confidence — keep mixing and encoding identities separate.** A WAV caller
  receives the existing exact PCM implementation. An M4A caller also pins the
  encoder implementation and resolved settings. Changing the encoder therefore
  changes its encoded rendition without invalidating an unchanged mix. Replaying
  an old export after defaults change returns its original bytes and receipt;
  a new export receives the new default. A single combined identity would discard
  useful PCM or permit encoded output to borrow the wrong settings.
- **High confidence — advertise only the demonstrated standalone rates and layouts.**
  A caller can request the verified AAC mono/stereo renditions at 44.1 or 48 kHz,
  using existing AAC strategy controls and native validation. Import support or
  a converter inventory does not grant MP3/FLAC/ALAC encoding support. An unbuilt
  broader list would promise files the public native path has not produced.
- **High confidence — widen the catalog constraint through the existing format policy.**
  A fresh catalog must accept durable audio intents. Its format advances when the
  export-kind constraint widens; older catalogs refuse under the repository's
  existing no-migration policy. Leaving the format unchanged would accept an old
  catalog whose table still rejects audio and fail only during a public write.
- **High confidence — extend existing native consumer semantics without inventing a picker.**
  An externally created audio export must decode in status/list and appear as Audio
  in the existing menu. Its actual destination is retained, and the existing save
  default is WAV. Video and package behavior stays unchanged. A new GUI format
  picker would add a user workflow outside this CLI/MCP-primary slice.

The plan explicitly required first-class audio output, one publication lifecycle,
zero editorial choices and no visual dependency. Internal naming and small typed
branch placement are implementation discretion rather than new product decisions.
