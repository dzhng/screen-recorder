# Native crossfade delivery

`transition-delivery.mjs` drives the public CLI/MCP asset import and edit path with
solid red and blue image sources. It applies one caller-authored crossfade from
250ms through 750ms, reads frames outside and at the midpoint, then renders the
same revision through `preview.get`.

The native frame receipt shows the same blue top layer outside the transition and
both explicit source channels at the midpoint (`[136, 0, 188]` mean RGB). The
preview contains all four declared project frames. This is a bounded picture
receipt for crossfade lowering and delivery; audio transitions, dip/flash and
reference-conditioned visual acceptance remain separate gates.
