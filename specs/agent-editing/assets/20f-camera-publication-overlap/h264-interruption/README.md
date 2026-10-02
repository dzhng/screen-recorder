# Qualified H.264 interruption preservation

This supplement closes the earlier small qualified-interruption evidence gap;
it leaves the original scheduling packet and damage experiment unchanged.
Complete sample tables qualify scheduling, but actual decoding still owns support.

The original fixture is avc1 with four-byte NAL lengths. Its final presented access
unit occupies an earlier storage position than the middle picture because of
reordering. One four-byte length alone was changed to an impossible value; every
native sample timing/storage range and complete probe metadata remained equal.
The exact inputs, terminal processes, crash and physical comparisons are bound in
[verification.json](verification.json); [authored.raw](authored.raw) identifies
the changed bytes and immutable original source.

Both old and corrected current owners publish the same one-picture physical prefix,
ordered digest, exact support and rawDecodeInterrupted diagnostic, preserving
binding, origin and journal/mapping identity. Current read-only SDK observation
records the private full candidate before raw starts, both readers reading, then
a different prefix canonical reader. The speculative file is removed, all readers
drain, and the observer implementation is restored. Container bytes, private paths
and separately serialized closed-marker identities differ; physical parity does
not imply their byte identity.

The first current attempt really dispatched readers, then trapped in the observer's
actor-isolated empty Swift callback. Its executed source, binary hash, actual
terminal and full crash report are retained; this was instrumentation failure,
not zero-dispatch setup or a production defect. The corrected invocation omits
that callback, preserves original SDK behavior, and saves outcomes before trap
postconditions. The old completed result was not repeated.

This establishes one qualified late-decode interruption and fallback preservation
case. It does not establish every native failure mode, peak memory, retained-take
latency or the ten-second stop gate. No production/module/worker change, additional
pattern, capture/playback/UI/model activity or timing measurement was performed.
