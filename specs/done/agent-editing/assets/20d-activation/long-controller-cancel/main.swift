import Foundation
import ScreenRecorderCapture
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let video = folder.appendingPathComponent("input.mov")
try await RecoveryFixture.writeVariableDurationVideo(to: video, timesUs: [0, 500000, 1500000, 2300000], endUs: 2500000)
let inputSession = PrerecordedCaptureInput(source: video)
inputSession.audio = URL(fileURLWithPath: CommandLine.arguments[2])
inputSession.omittedAudioBuffer = 4
inputSession.audioRoles = [.microphone]
let controller = CaptureController(fixtureWindow: nil)
let host = ServiceHost()
host.holdTerminal = false
controller.attach(to: host)
let request = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline", "sourceId":"source-offline", "outputDirectory":folder.appendingPathComponent("take").path, "source":["kind":"window","windowId":1], "microphone":true, "systemAudio":false])
guard case .success = await controller.handle("capture.start", request) else { fatalError("Start refused") }
let params = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline"])
let before = ContinuousClock.now
guard case .success(let response) = await controller.handle("capture.stop", params) else { fatalError("Stop refused") }
let acknowledgment = try JSONSerialization.jsonObject(with: response) as! [String:Any]
precondition(acknowledgment["state"] as? String == "finalizing")
precondition(before.duration(to: .now) < .seconds(10))
try await Task.sleep(for: .seconds(2))
guard case .success(let stateBytes) = await controller.handle("capture.status", Data("{}".utf8)) else { fatalError("Status refused") }
let state = try JSONSerialization.jsonObject(with: stateBytes) as! [String:Any]
precondition(state["state"] as? String == "finalizing")
let cancelStarted = ContinuousClock.now
guard case .success(let settled) = await controller.handle("capture.cancel", params) else { fatalError("Cancel refused") }
let cancelDuration = cancelStarted.duration(to: .now)
precondition(cancelDuration < .seconds(10))
let terminal = try JSONSerialization.jsonObject(with: settled) as! [String:Any]
// The native discard acknowledgment stays finalizing; CaptureService owns canceled deletion.
precondition(terminal["state"] as? String == "finalizing")
guard case .success(let idleBytes) = await controller.handle("capture.status", Data("{}".utf8)) else { fatalError("Idle status refused") }
let idle = try JSONSerialization.jsonObject(with: idleBytes) as! [String:Any]
precondition(idle["state"] as? String == "idle" && idle["recordingId"] is NSNull)
let lease = try CaptureJournalLease(directory: folder.appendingPathComponent("take").path)
try lease.check()
print("actual publication canceled and lease released in \(cancelDuration)")
try settled.write(to: folder.appendingPathComponent("terminal.json"))
print("PASS real controller cancels in-progress sparse publication and drains journal ownership")
