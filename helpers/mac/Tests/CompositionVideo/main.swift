import Foundation
import ScreenRecorderWire

let requestFile = CommandLine.arguments[1]
let request = try String(contentsOfFile: requestFile, encoding: .utf8)
let params = try JSONSerialization.jsonObject(with: Data(request.utf8)) as! [String: Any]
let output = params["output"] as! String
let directory = URL(fileURLWithPath: output).deletingLastPathComponent()
let line = String(
    data: try JSONSerialization.data(withJSONObject: [
        "id": "cancel", "operation": "media.renderCompositionVideo", "params": params,
    ]), encoding: .utf8)!
let work = Task { await NativeWire.respond(to: line) }
let deadline = ContinuousClock.now.advanced(by: .seconds(10))
while !(try FileManager.default.contentsOfDirectory(atPath: directory.path)).contains(where: {
    $0.hasPrefix(".screenrec-output-")
}) {
    precondition(ContinuousClock.now < deadline, "Renderer never acquired its output workspace")
    try await Task.sleep(for: .milliseconds(1))
}
work.cancel()
let response = try JSONSerialization.jsonObject(with: await work.value) as! [String: Any]
precondition(response["ok"] as? Bool == false, "Canceled render must not publish success")
precondition(!FileManager.default.fileExists(atPath: output), "Canceled render published output")
let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
precondition(
    !remaining.contains(where: { $0.hasPrefix(".screenrec-output-") }),
    "Canceled render leaked staging")
print("PASS production NativeWire task cancellation drains writer and removes staging")
