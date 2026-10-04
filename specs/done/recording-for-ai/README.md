# Recording rationale and retained evidence

Status: closed as shipped, with the limitations accepted in the toolkit's
[release disposition](../agent-editing/release-closeout.md). Closure retires the
original build plan; it does not certify the historical unchecked gates.

## Why capture and evidence are separate

An agent needs more than a movie: it needs source identity, capture geometry,
recoverable observations and inspection evidence before making an explicit edit.
The recorder retains those facts while leaving editorial intent to its caller.
Original media remains the authority; a derivative or a successful decoder cannot
silently repair missing acquisition evidence.

The original design separated native device execution from durable library
ownership and short-lived clients. That separation keeps capture permissions and
service lifetime with the app, while CLI and MCP share the same operation meaning.
Current boundaries live in the [native app](../../../apps/macos/README.md),
[native capture owner](../../../helpers/mac/Sources/ScreenRecorderCapture/README.md),
[core](../../../packages/core/README.md) and
[protocol](../../../packages/protocol/README.md). Their code owns mechanics and
current schemas.

## What diverged from the plan

The original recording timeline, index and package owners were superseded during
the broader [agent-editing work](../agent-editing/README.md). Its
[preservation registry](../agent-editing/assets/23-owner-fixture-ports/README.md)
locates the proof carried through those changes. New work follows current owners,
not the old trim/cut-only format or retired operation names.

The personal-release plan relied on a host Node installation; released packages
instead carry their runtime. [Build and release ownership](../../../scripts/README.md)
and the app's [runtime resolver](../../../apps/macos/Sources/ScreenRecorder/NodeRuntime.swift)
own that delivery contract. Public distribution and automatic updating were not
part of the recording implementation.

The [original plan snapshot](https://github.com/dzhng/screen-recorder/tree/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai)
preserves the removed slice ladder and exact checklists. [Discovery](MAP.md),
[decisions](choices.md), [research](research.md), [architecture](architecture.md),
[contracts](contracts.md) and [verification](verification.md) remain historical
records, not current implementation instructions.

## Evidence and visual provenance

The [evidence directory](assets/) preserves original observations, producer
records and failures. The [settings captures](assets/settings-window/README.md)
and [recording-overlay captures](assets/recording-overlay/README.md) retain the
actual app's light/dark controls and their fixture provenance. They document state
legibility; controlled permission displays do not prove a new user's authorization.

The [browser text comparison](assets/text-fidelity/README.md) uses captured source
pixels as its standard. It retains matched images and blind review behind the
historical choice to keep automatic bitrate: the larger setting's small numerical gain did
not establish a consistent readability advantage. These samples do not certify
all screen content or motion quality.

Physical capture, recovery and synchronization depend on actual platform inputs.
Speech and cut quality require independent audible labels. Controlled fixtures
cannot replace those observations, and later fixes cannot turn an original failure
into a pass. The [accepted limitations](../agent-editing/release-closeout.md#accepted-limitations)
remain explicit. Use [current verification tools](../../../packages/test-harness/README.md)
for reproduction; retain frozen reports at their recorded revisions.
