import Foundation
import ScreenRecorderCapture
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let video = folder.appendingPathComponent("input.mov")
try await RecoveryFixture.writeVariableDurationVideo(to: video, timesUs: [0, 500000, 1500000, 2300000], endUs: 2500000)
let inputSession = PrerecordedCaptureInput(source: video)
inputSession.audio = URL(fileURLWithPath: CommandLine.arguments[2])
inputSession.omittedAudioBuffer = 4
inputSession.audioRoles = [.microphone, .audio]
let controller = CaptureController(fixtureWindow: nil)
let host = ServiceHost()
host.holdTerminal = false
controller.attach(to: host)
let request = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline", "sourceId":"source-offline", "outputDirectory":folder.appendingPathComponent("take").path, "source":["kind":"window","windowId":1], "microphone":true, "systemAudio":true])
guard case .success = await controller.handle("capture.start", request) else { fatalError("Start refused") }
let blocked = folder.appendingPathComponent("take/.capture-publication-narration")
try FileManager.default.createDirectory(at: blocked, withIntermediateDirectories: false)
try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: blocked.path)
let params = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline"])
let before = ContinuousClock.now
guard case .success(let response) = await controller.handle("capture.stop", params) else { fatalError("Stop refused") }
let acknowledgment = try JSONSerialization.jsonObject(with: response) as! [String:Any]
precondition(acknowledgment["state"] as? String == "finalizing")
precondition(before.duration(to: .now) < .seconds(10))
for _ in 0..<200 {
    if host.reports.contains(where: { $0["finalizationError"] is [String:Any] }) { break }
    try await Task.sleep(for: .milliseconds(25))
}
try JSONSerialization.data(withJSONObject: host.reports).write(to: folder.appendingPathComponent("failed-reports.json"))
guard let failed = host.reports.last?["finalizationError"] as? [String:Any] else { fatalError("Native publication failure must be durable") }
precondition(failed["retryable"] as? Bool == true)
try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: blocked.path)
guard case .success(let retried) = await controller.handle("capture.stop", params) else { fatalError("Retry refused") }
let retryReceipt = try JSONSerialization.jsonObject(with: retried) as! [String:Any]
precondition(retryReceipt["finalizationError"] is NSNull)
for _ in 0..<400 {
    if host.reports.last?["state"] as? String == "complete" { break }
    try await Task.sleep(for: .milliseconds(25))
}
precondition(host.reports.last?["state"] as? String == "complete")
try JSONSerialization.data(withJSONObject: host.reports).write(to: folder.appendingPathComponent("reports.json"))
print("PASS actual native operational publication failure reports bounded retryable state and clears only on retry")
