# Local service client

The client performs one framed socket exchange and owns bounded discovery.
[The call implementation](src/index.ts) and [discovery](src/discovery.ts) share
[protocol framing](../protocol/README.md); neither owns domain edits or retries.

## Discovery is preparation, not execution

Explicit socket selection connects directly. Default discovery probes health
and can ask macOS to launch the selected app without activating its UI. Help and
schema discovery do not require that process. App selection and library selection
are separate: an already-running app retains the home it started with, so choosing
another home cannot silently redirect that instance.

One deadline covers discovery and startup. Cancellation prevents a late app
launch and ends pending transport work. Health probes do not execute the requested
operation; the caller sends it once after preparation.

## Uncertain writes remain uncertain

Disconnect and timeout settle the local exchange, but cannot undo a committed
mutation. Recover through the operation's exact-request replay contract, retaining
its durable identity and arguments. Automatic transport retries would risk applying
a different write after the caller has lost the original answer.
