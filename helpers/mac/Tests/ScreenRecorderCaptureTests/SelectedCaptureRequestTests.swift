import Foundation
import ScreenRecorderCapture

func runSelectedCaptureRequestTests() throws {
    let base: [String: Any] = [
        "source": ["kind": "display", "displayID": 7], "cameraID": "selected-camera",
        "microphone": ["enabled": true, "deviceID": "selected-mic"],
        "outputDirectory": "/tmp/explicit-evidence", "framesPerSecond": 30,
        "durationSeconds": 620, "cameraDelaySeconds": 0.25,
        "pause": ["atSeconds": 300, "durationSeconds": 10],
    ]
    func decode(_ value: [String: Any]) throws -> SelectedCaptureRequest {
        try JSONDecoder().decode(SelectedCaptureRequest.self,
            from: JSONSerialization.data(withJSONObject: value))
    }
    let request = try decode(base)
    try request.validate()
    try request.requireAuthorization(screen: true, camera: true, microphone: true)
    for field in ["cameraID", "microphone", "source", "outputDirectory", "durationSeconds"] {
        var bad = base; bad.removeValue(forKey: field)
        do { try decode(bad).validate(); preconditionFailure("Missing \(field) accepted") }
        catch {}
    }
    let invalid: [[String: Any]] = [
        ["cameraID": " "], ["microphone": ["enabled": true]],
        ["microphone": ["enabled": false, "deviceID": "unused"]],
        ["source": ["kind": "display"]], ["source": ["kind": "fixture"]],
        ["source": ["kind": "region", "displayID": 7]],
        ["source": ["kind": "window", "windowID": 4, "displayID": 7]],
        ["durationSeconds": 0], ["cameraDelaySeconds": 620],
        ["pause": ["atSeconds": 615, "durationSeconds": 10]],
        ["outputDirectory": "relative"], ["framesPerSecond": 0],
    ]
    for values in invalid {
        do {
            try decode(base.merging(values) { _, new in new }).validate()
            preconditionFailure("Invalid request accepted: \(values)")
        } catch let error as CaptureFailure { precondition(error.code == "INVALID_REQUEST") }
    }
    for grants in [(false,true,true), (true,false,true), (true,true,false)] {
        do {
            try request.requireAuthorization(screen: grants.0, camera: grants.1, microphone: grants.2)
            preconditionFailure("Missing authorization accepted")
        } catch let error as CaptureFailure { precondition(error.code == "PERMISSION_REQUIRED") }
    }
    let disabled = try decode(base.merging(["microphone": ["enabled": false]]) { _, new in new })
    try disabled.requireAuthorization(screen: true, camera: true, microphone: false)
    try SelectedCaptureRequest.requireDevice("selected-camera", among: ["other", "selected-camera"], role: "camera")
    do {
        try SelectedCaptureRequest.requireDevice("selected-camera", among: ["other"], role: "camera")
        preconditionFailure("Device fallback")
    } catch let error as CaptureFailure { precondition(error.code == "SOURCE_UNAVAILABLE") }
    print("SelectedCaptureRequestTests passed (pure descriptors, no permission/device APIs)")
}
