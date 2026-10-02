# Compiled project PNG publication

Project PNGs now publish the existing compiled graph directly through FrameImage.
They avoid the movie terminal's Rec.709 BGRA quantization, which changed source
samples before PNG encoding. The graph still executes every requested primitive;
there is no identity shortcut, lookup or tolerance.

Source/pointer preparation and graph construction remain owned by
CompositionPictureExecutor. PNG publication consumes its transient graph. Movie
rendering checks the same physical/visual/pointer key before composing and keeps
its retained buffer, allocator and Rec.709 attachments. No additional graph cache
or public operation was introduced.

[Verification](verification.json) records the public frozen-worker red, candidate
static-owner green and permanent asymmetric regression. Complete retained RGBA
bytes now equal the fixed source. The actual [request](baseline-request.jsonl),
[baseline reply](baseline-reply.jsonl) and [candidate result](candidate-result.json)
are preserved. Identical large image/sample bytes reuse the existing stage packet.

Movie neighbor controls establish buffer reuse, metadata and one shifted pixel
sample; they do not establish full movie pixel equality against baseline. The
first geometry control's coverage polygon did not follow its affine; that authored
fixture error is retained, and its explicit footprint was corrected. Original
historical decoder evidence and full paired-frame release acceptance stay open.
