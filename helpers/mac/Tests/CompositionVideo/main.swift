import Foundation
import ScreenRecorderWire

let requestFile = CommandLine.arguments[1]
let operation =
    CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "media.renderCompositionVideo"
let mode = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "cancel"
precondition(["cancel", "collision", "mutate-pointers"].contains(mode))
let request = try String(contentsOfFile: requestFile, encoding: .utf8)
let params = try JSONSerialization.jsonObject(with: Data(request.utf8)) as! [String: Any]
let output = params["output"] as! String
let directory = URL(fileURLWithPath: output).deletingLastPathComponent()
let line = String(
    data: try JSONSerialization.data(withJSONObject: [
        "id": mode, "operation": operation, "params": params,
    ]), encoding: .utf8)!
let work = Task { await NativeWire.respond(to: line) }
let deadline = ContinuousClock.now.advanced(by: .seconds(10))
func reachedStaging() throws -> Bool {
    let children = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        .filter { $0.hasPrefix(".screenrec-output-") }
    if mode != "mutate-pointers" { return !children.isEmpty }
    // CompositionVideo creates its writer only after PreparedPointers validates the receipt.
    // Movie assembly owns one outer staging directory, with that video writer nested inside it.
    for child in children {
        let parent = directory.appendingPathComponent(child)
        if FileManager.default.fileExists(atPath: parent.appendingPathComponent("video.mp4").path) {
            return true
        }
        for nested in (try? FileManager.default.contentsOfDirectory(atPath: parent.path)) ?? []
        where nested.hasPrefix(".screenrec-output-") {
            if FileManager.default.fileExists(atPath: parent.appendingPathComponent(nested)
                .appendingPathComponent("video.mp4").path) { return true }
        }
    }
    return false
}
while try !reachedStaging() {
    precondition(ContinuousClock.now < deadline, "Renderer never reached the required staging boundary")
    try await Task.sleep(for: .milliseconds(1))
}
switch mode {
case "cancel": work.cancel()
case "collision":
    try Data("concurrent owner's sentinel".utf8).write(to: URL(fileURLWithPath: output), options: .withoutOverwriting)
case "mutate-pointers":
    let receipt = params["pointers"] as! [String: Any]
    let file = URL(fileURLWithPath: receipt["file"] as! String)
    let original = try String(contentsOf: file, encoding: .utf8)
    guard let coordinate = original.range(of: "\"x\":[0-9]+", options: .regularExpression) else {
        preconditionFailure("Mutation fixture must contain a pointer coordinate")
    }
    let value = Int(original[coordinate].dropFirst(4))!
    let changed = original.replacingCharacters(in: coordinate, with: "\"x\":\(value + 1)")
    try Data(original.utf8).write(to: directory.appendingPathComponent("pointer-before.jsonl"))
    try Data(changed.utf8).write(to: file)
    try Data(changed.utf8).write(to: directory.appendingPathComponent("pointer-after.jsonl"))
default: preconditionFailure("Unknown observation mode")
}
let reply = await work.value
try reply.write(to: directory.appendingPathComponent(mode + "-response.json"))
let response = try JSONSerialization.jsonObject(with: reply) as! [String: Any]
precondition(response["ok"] as? Bool == false, "Interrupted or conflicting render must not publish success")
if mode == "collision" {
    let error = response["error"] as! [String: Any]
    precondition(error["code"] as? String == "INVALID_OUTPUT")
    let sentinel = try String(contentsOfFile: output, encoding: .utf8)
    precondition(sentinel == "concurrent owner's sentinel")
} else {
    if mode == "mutate-pointers" {
        let error = response["error"] as! [String: Any]
        precondition(error["code"] as? String == "INVALID_REQUEST")
        let message = error["message"] as? String
        // A reader that already buffered the original rows detects the file-version change;
        // a reader that consumes the changed rows detects the digest mismatch instead.
        precondition(message == "Retained JSONL digest differs from receipt." ||
            message == "Retained JSONL changed while reading.",
            "Pointer mutation must fail at retained-input verification: \(response)")
    }
    precondition(!FileManager.default.fileExists(atPath: output), "Interrupted render published output")
}
let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
precondition(!remaining.contains(where: { $0.hasPrefix(".screenrec-output-") }),
    "Interrupted render leaked staging")
print("PASS production NativeWire \(mode) preserves publication and removes staging")
