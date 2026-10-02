# Fixed-image composition stage boundary

Status: diagnostic complete; [PNG publication correction](23l2-project-png-publication.md)
is implemented. Full paired-frame acceptance remains open.

The [stage record](../assets/23l-image-color-stages/README.md) owns a bounded answer
to the missing composition-path question: a fixed retained PNG remains byte-exact
through direct publication and through the same compiled graph's direct publication,
but changes through the graph's Rec.709 BGRA terminal/publication route. Complete
samples, formats, profiles, color attachments and observed owner boundaries are
retained. Original material and the failed compile remain unchanged.

This comparison uses retained compiled objects, current pinned modules/SDK and the
unchanged pixel oracle in a standalone process. It neither rebuilds nor replaces
the frozen worker. It observes the lazy graph and public terminal/provider samples,
not private half-float framebuffer pixels. The original movie decoder buffers
remain unavailable, so historical decoder cause and original worker-binary
execution equivalence are unproved.

The [PNG publication owner](23l2-project-png-publication.md) now separates shared
graph construction from still and movie targets. This diagnostic itself changes
no product behavior and proves no historical decoder cause.
