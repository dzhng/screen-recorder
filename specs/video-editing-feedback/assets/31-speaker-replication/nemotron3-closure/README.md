# Nemotron-3 runtime-closure admission

Status: **refused for acquisition admission**. A relocated APFS clone of the
existing first-party runtime, with the exact NeMo and Lhotse source trees copied
inside the closure, restored the pinned checkpoint while donor roots and network
were denied. That is a relocation smoke test, not a clean acquisition proof:
the clone still shares storage with the donor and the source files were not
materialized through Yap's pinned runtime acquisition recipe.

A fresh materialization could not be started honestly because the machine had
about 152 MiB free while the base runtime alone occupies about 1.62 GB. The
interpreter, source/wheel inputs, pip environment, assembly staging and output
would need to coexist. No short controls were rerun and no long-form claim was
made.

`protocol.json` retains every input revision, hash and boundary. The previous
source-overlay short gate remains the quality result: two controls pass and
`aiqwk30` misses overlap recall. The next attempt needs scratch storage large
enough for an independent `python-wheels-v1` materialization, then the same
three short controls in the preregistered order.
