@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture

/// Opt-in native-rate replay; timing is evidence, never a machine-dependent pass threshold.
@MainActor
func runSelectedCaptureStopScale(output: String, sourcePath: String) async throws {
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let source = URL(fileURLWithPath: sourcePath)
    let asset = AVURLAsset(url: source)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let size = try await track.load(.naturalSize)
    let duration = try await asset.load(.duration)
    precondition(duration.seconds > 0 && duration.seconds < 600, "Replay is bounded to ten minutes")
    let folder = root.appendingPathComponent("take")
    let input = PrerecordedCaptureInput(source: source, size: size)
    input.paceVideo = true
    input.probeDirectory = folder
    let capture = NativeCapture(prepareInput: { _ in input })
    let probe = SelectedCaptureProbe()
    let request = try JSONDecoder().decode(SelectedCaptureRequest.self,
        from: JSONSerialization.data(withJSONObject: [
            "source": ["kind": "display", "displayID": 7], "cameraID": "unused-offline",
            "microphone": ["enabled": false], "outputDirectory": root.path,
            "framesPerSecond": 30, "durationSeconds": 3600, "cameraDelaySeconds": 0,
        ]))
    let began = ContinuousClock.now
    let task = Task { try await probe.record(capture, request: request,
        screenRequest: CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.path)) }
    while capture.deviceState != "recording" {
        precondition(began.duration(to: .now) < .seconds(duration.seconds + 60), "Replay did not finish startup")
        try await Task.sleep(for: .milliseconds(20))
    }
    let stopAt = ContinuousClock.now
    probe.requestStop()
    let result = try await task.value
    let stoppedAt = ContinuousClock.now
    let persisted = try Data(contentsOf: root.appendingPathComponent("screen-result.json"))
    precondition(persisted == result, "Stop returned before durable screen result")
    let screen = try JSONDecoder().decode(CaptureResult.self, from: result)
    let camera = try JSONDecoder().decode(CaptureResult.self,
        from: Data(contentsOf: folder.appendingPathComponent("camera/capture-result.json")))
    let publication = try JSONDecoder().decode(CameraMedia.Receipt.self,
        from: Data(contentsOf: folder.appendingPathComponent("camera/camera.publication.json")))
    precondition(screen.failure == nil && camera.failure == nil, "Closure must succeed")
    precondition(publication.diagnostics.isEmpty && publication.representedFrames == input.offeredVideoFrames,
        "Every offered camera picture must survive admission and exact PTS/BGRA publication verification")
    precondition(camera.tracks[0].samples == publication.representedFrames
        && camera.tracks[0].droppedSamples == 0 && camera.tracks[0].omittedSamples == 1)
    let rows = try String(contentsOf: folder.appendingPathComponent("timestamps.jsonl"), encoding: .utf8)
        .split(separator: "\n").map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
    let dispositions = rows.filter { $0["role"] as? String == "camera" }.map { $0["disposition"] as! String }
    precondition(dispositions == ["outside-support"] + Array(repeating: "accepted", count: input.offeredVideoFrames)
        + ["sealed-or-failed"], "Only pre-origin and post-seal boundary probes may be omitted")
    precondition(camera.hostOriginUs == screen.hostOriginUs && camera.tracks[0].firstSampleUs == 200000)
    func seconds(_ elapsed: Duration) -> Double {
        Double(elapsed.components.seconds) + Double(elapsed.components.attoseconds) / 1e18
    }
    let report: [String: Any] = [
        "source": source.path, "width": input.width, "height": input.height,
        "sourceDurationSeconds": duration.seconds, "offeredPictures": input.offeredVideoFrames,
        "acquisitionWallSeconds": seconds(began.duration(to: stopAt)),
        "stopToDurableResultSeconds": seconds(stopAt.duration(to: stoppedAt)),
        "cameraPictureSHA256": publication.pictureSHA256,
        "representedPictures": publication.representedFrames,
        "cameraOmittedSamples": camera.tracks[0].omittedSamples,
        "cameraFirstUs": publication.firstUs, "cameraEndUs": publication.endUs,
        "scope": "Native-rate prerecorded screen/camera replay; microphone disabled; no AppKit quit timer or physical devices",
    ]
    try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        .write(to: root.appendingPathComponent("measurement.json"), options: .atomic)
    print("PASS selected probe full stop: \(publication.representedFrames) pictures, \(seconds(stopAt.duration(to: stoppedAt)))s to durable result")
}
