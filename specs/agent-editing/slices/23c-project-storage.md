# 23c — Isolated project-library storage preservation

Status: scoped isolated implementation, focused verification and independent root review pass. Parent:
[23](23-cutover.md). Dependencies: existing asset, cache, project service and
publication owners; final installed switching remains with parent 23.

## Contract

Preserve truthful live managed byte observations in the fresh library through
one containment and lifetime owner. Reuse the existing aggregate public shape;
retained library files are shared across projects, registered derivatives are
cache bytes and private external staging remains publication-owned. Count partial
and unattributed files, exclude models and donors, refuse recording scopes in
the isolated project service, and retain recording behavior unchanged.

## Verification boundary

Preserve symlink/replacement safety, concurrent observation coalescing, bounded
scan yielding and shutdown drain before catalog closure. Drive the isolated
service through its real socket with scratch files and controlled filesystem
holds. [Evidence](../assets/23c-project-storage/README.md) records exact gates and
limits. This pass establishes neither capture-to-project publication nor installed
consumer discovery, switching or obsolete-owner deletion.
