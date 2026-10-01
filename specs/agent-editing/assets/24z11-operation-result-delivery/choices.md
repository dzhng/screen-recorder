# 24z11 choices

## Sound — medium confidence

**Use a conservative transport byte budget.** When a result might fit a particular
MCP message but approaches the receive boundary, the service can deliver it as
JSON chunks instead. The adapter's budget reserves the existing control-frame
headroom and allows one structural copy plus the worst quoted-text copy. The plan
required a derived budget but did not pick its margin. This makes some otherwise
deliverable large results take the artifact path; it preserves all their data and
avoids teaching the service MCP serialization. Future attachment work must still
budget its complete messages. Sound: the margin uses existing protocol bounds,
does not increase them, and ordinary small replies keep their form.

**Replay the retained receipt at a controlled storage edge.** A scratch project
row and request lookup point to the exact saved 24y result. Public service/core
replay, the real MCP adapter and an unconfigured SDK deliver it without new clip
authoring. The plan specified the receipt authority but not fixture admission.
This proves transport and replay retrieval; it intentionally cannot certify the
old catalog's history, admissions or original request arguments. Sound: those
remain separate historical evidence, and a distinct real tiny edit proves one
commit after reply loss.

## Sound — high confidence

**Expose result delivery only as a local transport preference.** A client asks
for its inline byte budget in the outer request, rather than adding fields to every
operation or making the service understand MCP. The plan left the envelope syntax
open. Ordinary callers still receive typed complete operation responses; opted
callers handle an explicit wire-response union. Sound: this gives the socket owner
one reusable decision and adds no operation endpoint or version negotiation.

**Keep standalone socket handlers explicit about delivery ownership.** Both
production compositions pass their existing owner to the listener. A standalone
handler that supplies no owner refuses an opted request before dispatch. The plan
did not specify that utility boundary. Sound: ordinary handlers remain usable and
the listener never invents a second lease owner.

Internal names, same-turn reservation conversion, fixture organization and the
complete byte-oracle implementation were delegated implementation discretion.
