# Camera picture hashing choices

## Sound — high confidence

**When:** offline camera publication performance pass, 2026-09-30.

**The choice:** Hash the existing locked pixel memory directly in the same private
picture-digest owner. When the publisher verifies a frame, it already holds the
pixel buffer's read-only lock. CryptoKit consumes a buffer view synchronously,
so each view finishes before unlocking. Rows whose physical stride equals their
visible width can be passed together; otherwise only the visible bytes of each
row enter the digest. The timestamp and dimension prefix stays identical. The
alternative would keep creating and copying a new Data object for every row.

**The gap:** The preservation contract fixed the digest's contents but left the
memory representation and hashing call granularity to implementation.

**The reach:** Camera raw/canonical verification keeps the same digest and
recovery authority while avoiding millions of temporary row copies. The code
continues to depend on the publisher's existing forced BGRA decoder format; this
adds no planar-image support or lifetime-spanning pointer cache.

**Verdict:** Sound. Complete retained-picture parity and contiguous/padded
publication tests preserve the byte stream, and stage timing identifies hashing
as the relevant measured cost. The change does not adjust the shutdown deadline.

**Confidence:** High.

## Sound — high confidence

**When:** the same pass's preservation checks.

**The choice:** Exercise contiguous and padded decoded memory through actual
publication, using two tiny encoded fixtures. A lossless BGRA movie makes the
contiguous case precise; an ordinary camera codec, H264, supplies realistic padded
rows. Independently serialized decoded pixels define the expected full picture
digests. The alternative would expose the private hashing function for tests or
create another maintained digest implementation.

**The gap:** The contract required preservation but did not prescribe a test seam
for memory layout and padding.

**The reach:** Default offline capture checks now protect timestamp/dimension
serialization, visible pixels and padding exclusion at the public publication
boundary. The fixtures and expected output are tied to the current native BGRA
decoder contract; changing that contract requires examining their provenance.

**Verdict:** Sound. The tests exercise the production owner and fail when padding
is included without adding a production test hook or parallel digest abstraction.

**Confidence:** High.
