# 21a — Public camera discovery and permission facts

Status: scoped isolated implementation, focused gates and independent root
integration review pass. Parent [21](21-webcam.md) remains open.

## Contract

The existing public capture discovery and status operations expose camera
identities and authorization facts through the shared native device owner.
Preserve the selected-device probe's enumeration order, device types and permission
meaning. Listing never selects or activates a camera or requests permission.
An empty device list is valid. Camera capture selectors remain unsupported by
the public start schema; no default camera, layout or finalization behavior is added.

## Verification boundary

Controlled native responses travel through the actual service, CLI and MCP.
The scripted native controller fixture compiles the actual controller and
substitutes only device and shareable-content boundaries. Preserve its existing
start/finalization race cases while checking discovered identities, order,
empty discovery and authorization states. Native compilation uses isolated
scratch and retained dependencies, without updating or replacing frozen workers.

[Evidence](../assets/21a-camera-discovery/README.md) records actual gates, negative
controls, fixture corrections and remaining scope. Hardware enumeration, camera
activation, live permission behavior, camera-start/result/finalization integration
and project adoption remain unverified here; physical acceptance stays under 20.
