# Home skill lifecycle

## Next Agent Prompt

Implement and verify the account-level Yap consumer-skill lifecycle. Protocol
schemas and the capability catalog are now landed; native routing and the
receipt-backed replacement path remain the next pickup. Replace the provisional
process runner with a transactional manager that stages a complete folder,
backs up existing global harness destinations, lets `npx skills` discover all
supported harnesses, verifies the result, and rolls back on failure. Add focused
tests for override, status, uninstall and rollback, then run the full check and
close this spec.

## Contract

Yap may maintain only the global consumer skill in the user's home directory.
Project-local skills and unrelated agent configuration remain untouched. An
existing folder is unmanaged until Yap has written its ownership receipt; the
app must report the conflict and refuse automatic replacement or removal. The
default preference is enabled. Turning it off removes only a receipt-backed
installation. App release updates and skill updates are separate operations.
