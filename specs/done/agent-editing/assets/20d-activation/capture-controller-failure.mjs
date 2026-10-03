import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const root = "/Users/david/.codex/worktrees/project-still-composition/screen-recorder/";
process.chdir(root);
const out = mkdtempSync("/tmp/capture-real-controller-"),
  tests = join(root, "helpers/mac/Tests/ScreenRecorderCaptureTests");
execFileSync(
  "swift",
  ["build", "--package-path", "helpers/mac", "--target", "ScreenRecorderCapture"],
  { stdio: "pipe" },
);
const bin = execFileSync("swift", ["build", "--package-path", "helpers/mac", "--show-bin-path"], {
  encoding: "utf8",
}).trim();
let controller = readFileSync("apps/macos/Sources/ScreenRecorder/CaptureController.swift", "utf8");
controller = controller.replace(
  "private let capture = NativeCapture()",
  "private let capture = NativeCapture(prepareInput: { _ in inputSession })",
);
writeFileSync(join(out, "CaptureController.swift"), controller);
let support = readFileSync(
  "apps/macos/tests/fixtures/capture-controller/ScriptedCapture.swift",
  "utf8",
);
support =
  support.slice(0, support.indexOf("@MainActor\nfinal class ScriptedCapture")) +
  support.slice(support.indexOf("struct ServiceFailure"));
writeFileSync(join(out, "Support.swift"), support);
writeFileSync(
  join(out, "main.swift"),
  `import Foundation
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
`,
);
const objects = ["ScreenRecorderCapture", "ScreenRecorderMedia"].flatMap((target) =>
  Object.values(
    JSON.parse(readFileSync(join(bin, target + ".build/output-file-map.json"))),
  ).flatMap((v) => (v.object ? [v.object] : [])),
);
execFileSync(
  "swiftc",
  [
    "-swift-version",
    "6",
    "-package-name",
    "mac",
    "-I",
    join(bin, "Modules"),
    join(out, "Support.swift"),
    join(out, "CaptureController.swift"),
    join(tests, "RecoveryFixtures.swift"),
    join(tests, "PrerecordedCaptureInput.swift"),
    join(out, "main.swift"),
    ...objects,
    "-o",
    join(out, "probe"),
  ],
  { stdio: "pipe" },
);
console.log(out);
process.stdout.write(
  execFileSync(
    join(out, "probe"),
    [out, join(root, "specs/agent-editing/assets/00-corpus/a-audio.wav")],
    { timeout: 30000 },
  ),
);
