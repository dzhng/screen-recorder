The replacement flow is broadly covered by focused tests, but a documented symlink-race conflict leaves staging that breaks subsequent storage observations.

Review comment:

- [P2] Handle retained conflict symlinks in storage accounting — /Users/server/dev/yap-exact-removal/helpers/mac/Sources/YapWire/PublicationOperation.swift:229-234
  When a noncooperating writer races a replacement with a symlink, the native owner intentionally leaves that symlink in `stage/swap`; however, `publication.usage` now enumerates `swap` while still requiring every private entry to be regular, so global `storage.usage` fails with `INVALID_STORAGE` while the conflicted export remains unresolved. Account for the retained symlink without following it, or report the conflict separately from aggregate storage measurement.