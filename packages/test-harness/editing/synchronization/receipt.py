"""Turn a bounded estimator result into source-bound evidence.

This module only admits a result already measured by ``offset.estimate``.  It
never searches for an offset, retimes media, selects an angle or mutates a
composition.  Refused estimator outcomes stay refused and carry no clock.
"""
import hashlib
import json
from typing import Any


def _source_key(source: dict[str, Any]) -> tuple[str, str]:
    if not isinstance(source, dict):
        raise ValueError("Synchronization sources must be objects")
    asset_id, stream_id = source.get("assetId"), source.get("streamId")
    if not isinstance(asset_id, str) or not asset_id or not isinstance(stream_id, str) or not stream_id:
        raise ValueError("Synchronization sources require nonempty assetId and streamId")
    return asset_id, stream_id


def _sources(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or len(value) < 2:
        raise ValueError("Synchronization evidence requires at least two sources")
    result: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for source in value:
        key = _source_key(source)
        if key in seen:
            raise ValueError("Synchronization sources must be distinct")
        seen.add(key)
        result.append({"assetId": key[0], "streamId": key[1]})
    return result


def _id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} must be a nonempty string")
    return value


def _accepted_measurement(estimate: dict[str, Any]) -> dict[str, Any]:
    if estimate.get("state") != "constant-offset":
        reason = estimate.get("reason")
        if not isinstance(reason, str) or not reason:
            reason = "unsuitable"
        return {"status": "refused", "reason": reason}

    offset = estimate.get("offsetFrames")
    rate = estimate.get("sampleRate")
    anchors = estimate.get("anchors")
    if (
        isinstance(offset, bool)
        or not isinstance(offset, int)
        or isinstance(rate, bool)
        or not isinstance(rate, int)
        or not 0 < rate <= 48000
        or not isinstance(anchors, list)
        or len(anchors) != 3
    ):
        raise ValueError("Constant-offset estimate is missing its bounded measurement")
    selected = [anchor.get("selectedFrames") if isinstance(anchor, dict) else None for anchor in anchors]
    if any(isinstance(value, bool) or not isinstance(value, int) for value in selected):
        raise ValueError("Constant-offset estimate requires three selected anchor offsets")
    spread = max(selected) - min(selected)
    policy = estimate.get("policy")
    maximum_spread_ms = policy.get("maximumSpreadMs") if isinstance(policy, dict) else None
    if isinstance(maximum_spread_ms, bool) or not isinstance(maximum_spread_ms, (int, float)):
        raise ValueError("Constant-offset estimate is missing its spread policy")
    if spread > rate * maximum_spread_ms / 1000 or offset != sorted(selected)[1]:
        raise ValueError("Constant-offset estimate does not satisfy its spread policy")
    return {
        "status": "accepted",
        "offsetFrames": offset,
        "sampleRate": rate,
        "spreadFrames": spread,
        "anchors": anchors,
    }


def make(
    estimate: dict[str, Any],
    sources: list[dict[str, str]],
    *,
    evidence_id: str,
    generation: str,
) -> dict[str, Any]:
    """Create an immutable evidence receipt without declaring an angle clock."""
    if not isinstance(estimate, dict):
        raise ValueError("Synchronization estimate must be an object")
    source_list = _sources(sources)
    evidence_id = _id(evidence_id, "evidence_id")
    generation = _id(generation, "generation")
    measurement = _accepted_measurement(estimate)
    if measurement["status"] == "refused":
        return measurement
    payload = {
        "id": evidence_id,
        "generation": generation,
        "status": "accepted",
        "method": "waveform",
        "sources": source_list,
        "measurement": {key: measurement[key] for key in ("offsetFrames", "sampleRate", "spreadFrames", "anchors")},
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    evidence = {
        "id": evidence_id,
        "generation": generation,
        "status": "accepted",
        "method": "waveform",
        "fingerprint": "sha256:" + hashlib.sha256(encoded).hexdigest(),
        "sources": source_list,
    }
    return {
        "evidence": evidence,
        "measurement": payload["measurement"],
        "mapping": "rightTime = leftTime + offsetFrames/sampleRate",
    }
