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
host.holdTerminal = true
controller.attach(to: host)
let request = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline", "sourceId":"source-offline", "outputDirectory":folder.appendingPathComponent("take").path, "source":["kind":"window","windowId":1], "microphone":true, "systemAudio":true])
guard case .success = await controller.handle("capture.start", request) else { fatalError("Start refused") }
let params = try JSONSerialization.data(withJSONObject: ["recordingId":"recording-offline"])
let before = ContinuousClock.now
guard case .success(let response) = await controller.handle("capture.stop", params) else { fatalError("Stop refused") }
let acknowledgment = try JSONSerialization.jsonObject(with: response) as! [String:Any]
precondition(acknowledgment["state"] as? String == "finalizing")
precondition(before.duration(to: .now) < .seconds(10))
await host.terminalEntered.wait()
guard case .success(let repeated) = await controller.handle("capture.stop", params) else { fatalError("Repeat refused") }
let same = try JSONSerialization.jsonObject(with: repeated) as! [String:Any]
precondition(same["state"] as? String == "finalizing" && same["sequence"] as? Int == acknowledgment["sequence"] as? Int)
let cancel = Task { await controller.handle("capture.cancel", params) }
host.terminalRelease.release()
guard case .success(let settled) = await cancel.value else { fatalError("Terminal join refused") }
let terminal = try JSONSerialization.jsonObject(with: settled) as! [String:Any]
precondition(terminal["state"] as? String == "complete")
try settled.write(to: folder.appendingPathComponent("terminal.json"))
print("PASS real controller/native/writer/publisher acknowledges finalizing and completed take wins cancellation")
