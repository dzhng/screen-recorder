# Optional inference runtimes

The [clone-only assembler](../../packages/test-harness/editing/optional-runtime-assemble.py)
creates local research artifacts from explicitly selected interpreter, dependency
and entry sources. It never installs packages, downloads models or modifies
donors. Prepared artifact verification and admission remain with the shared model
owner; cancellation and process lifetime remain with the service.

Dependency order is part of model execution. The primary dependency tree retains
ordinary Python startup behavior. Supplemental trees preserve their original
order through the [bundle-local launcher](launch.py), which appends them after
ordinary primary startup, including its admitted paths, without processing their
path files. This preserves namespace
and metadata precedence without flattening competing packages or enabling hooks
that the original runtime never executed.

Only explicitly declared donor path files may be removed. Their contents must
name the admitted supplemental trees. Nested files with the same extension can
be checkpoint data and stay unchanged. Other primary path entries must remain
within their dependency tree. Executable primary startup hooks retain source
bytes and need review in each frozen closure protocol.

Clone receipts verify copied bytes, distinct inodes, file modes and contained
links. Base development metadata stays outside the execution closure.
An explicit native policy can remove identified foreign wheel search paths from
clones and re-sign them. The [native observer](../../packages/test-harness/editing/runtime-native.py)
retains complete bounded before/final operands and compares section content,
addresses, flags and full dependency-command identities. These are packaging
changes, never permission to alter model or computational code. Native install
identifiers are identities; they are distinct from paths the loader searches.

Model checkpoints remain separate inputs. Lightweight import controls
prove bootstrap ordering; they do not prove native interpreter relocation,
inference parity, model quality or redistribution readiness. Those claims need
the exact artifact inventory, licenses and a relocated execution gate.
