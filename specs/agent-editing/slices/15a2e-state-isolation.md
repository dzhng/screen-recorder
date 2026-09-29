# 15a2e — Selected input and ordered consumer isolation

Status: verified within the initial mono/structural-dual-mono domain; [evidence](../assets/15a2e-state-isolation/README.md). Dependencies: [15a2d](15a2d-linked-denoise-runtime.md). Extends the linked runtime without changing the fixed adapter, channel policy, state graph or prepared ownership.

Complete selected input is established before inference. In the matched48k/unit-rate controls, poison outside the authored active interval cannot influence its output. Source-rate conversion retains its existing upstream context policy; these controls do not establish poison isolation across arbitrary resampling contexts. Exact disconnected windows keep separate state even when their boundaries lower to adjacent sample positions. Structural mono overlap is mixed by the ordinary native prefix before group processing; treating each contributor independently is a different signal and is retained as a negative control.

Animated gain uses the existing native scalar lowering both as execution and as the upstream reference signal; this pass introduces no curve evaluator. Gain before and after learned state produces distinct results, and dry neighbors remain exact. Actual physical stereo cannot masquerade as stored mono provenance.

Public dry/after-instance taps, bypass, undo, restore and historical reads preserve their current ordered meaning. Explicit dry inspection remains available when learned execution is unavailable. The check exposed an optional-field wire regression, repaired separately by omitting absent state payloads; strict serialization stays unchanged.

This is numerical/current-input acceptance only. [Independent channels](15a2f-independent-channels.md), [portable learned transfer](../assets/14a-learned-portable/README.md), and [successful long output](24f-successful-learned-scale.md) now have their own scoped evidence. The verified [combined public join](15a3a-unit-rate-combined.md) fills the scoped integration gap without repeating those primitive matrices. Post-retime and listening requirements remain open.
