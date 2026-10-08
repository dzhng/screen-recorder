# Home skill lifecycle

## Next Agent Prompt

Implement and verify the account-level Yap consumer-skill lifecycle. Protocol
schemas, capability catalog, native routing, replacement backup and rollback are
landed. Finish the lifecycle tests and full repository verification, then close
this spec.

## Contract

Yap may maintain only the global consumer skill in the user's home directory.
Project-local skills and unrelated agent configuration remain untouched. When
maintenance is enabled, the app may replace an existing global Yap skill through
the pinned `npx skills` transaction; the resulting receipt makes later status,
update and uninstall ownership explicit. The default preference is enabled.
Turning it off removes only the managed global installation. App release updates
and skill updates are separate operations.
