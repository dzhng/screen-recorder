# Optional inference runtimes

The [assembler](assemble.py) creates independent execution artifacts from selected
interpreter, dependency and entry sources. It never changes donors.
[Preparation](prepare.py) materializes the curated
[upstream alignment inputs](alignment-inputs.json) offline before assembly.
The shared Models owner downloads and hashes those inputs, verifies the complete
resulting inventory and publishes readiness. The service supplies its existing
owned CLI lifetime, including cancellation and descendant retirement.

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
clones and re-sign them. The [native observer](native.py)
retains complete bounded before/final operands and compares section content,
addresses, flags and full dependency-command identities. These are packaging
changes, never permission to alter model or computational code. Native install
identifiers are identities; they are distinct from paths the loader searches.

The native policy removes only declared thin-ARM64 search commands without moving
sections, then uses the operating system's signer. Consumer preparation needs no
developer tools. Installer metadata retains public upstream URLs; discarded
console wrappers cannot bind a runtime to a private build path. The
[registration producer](register-alignment.mjs) binds the measured inventory and
current execution resources to the shared model registry.

Optional workers route compiler caches through the existing Models-owned cache,
outside the immutable inventory. Disabling Python bytecode does not prevent
dependencies from probing in-tree compiler cache directories; readiness must
remain valid after inference as well as before it.

Model checkpoints remain separate inputs. Lightweight import controls
prove bootstrap ordering; they do not prove native interpreter relocation,
inference parity, model quality or redistribution readiness. Those claims need
the exact artifact inventory, licenses and a relocated execution gate.
