# Fixed-image composition stage boundary

Status: diagnostic complete; production correction and full paired-frame acceptance
remain open.

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

The next implementation boundary is shared compiled graph construction with
separate still PNG publication and movie buffer targets. Preserve the single graph
owner, explicit caller operations and movie format semantics. Do not bypass the
graph for identity inputs, substitute a lookup/tolerance or silently close the
original preservation contract. Product behavior is unchanged by this diagnostic.
