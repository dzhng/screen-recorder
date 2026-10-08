# Home skill lifecycle

## Next Agent Prompt

Implement and verify the account-level Yap consumer-skill lifecycle. The first
slice adds the persisted `installSkill` preference and Settings toggle. The next
slice must replace the provisional process runner with a receipt-backed,
transactional manager that stages a pinned complete skill folder, preserves
unmanaged/custom installs, and removes only Yap-owned paths. Add focused tests
for discovery, update, uninstall and rollback, then revise the lifecycle docs.

## Contract

Yap may maintain only the global consumer skill in the user's home directory.
Project-local skills and unrelated agent configuration remain untouched. An
existing folder is unmanaged until Yap has written its ownership receipt; the
app must report the conflict and refuse automatic replacement or removal. The
default preference is enabled. Turning it off removes only a receipt-backed
installation. App release updates and skill updates are separate operations.
