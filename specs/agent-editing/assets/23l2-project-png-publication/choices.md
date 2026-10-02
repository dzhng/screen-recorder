# Choices

**Sound, high confidence — transient preparation plus one graph builder.** Both
PNG and movie requests prepare their sources and consume pointer rows. PNG asks
the common builder for an image. Movie first checks whether its existing pixel
buffer still describes the same source samples and operations, and builds only
when that key changes. This preserves held-frame work without retaining a second
lazy image just to connect APIs. The split is internal; callers keep the same
requests and publications.

**Sound, high confidence — retain the movie target and change the PNG target.**
The fixed image remains exact through direct graph publication but changes through
the tagged movie buffer. PNG therefore uses its established encoder on the graph;
movie keeps the existing buffer format, attachments and allocation behavior.
This corrects a primitive, without deciding how a caller should edit content.

**Sound, high confidence — reuse existing complete material authority.** The new
baseline/candidate PNGs and RGBA arrays equal the earlier retained stage outputs.
Keep actual request/reply evidence and refer to those complete immutable samples,
rather than duplicating image or runtime archives. Narrow movie controls remain
explicitly narrower than a full movie-pixel or release claim.
