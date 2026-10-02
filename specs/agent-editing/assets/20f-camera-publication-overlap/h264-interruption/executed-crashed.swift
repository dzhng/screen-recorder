@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia

@main enum Publish {
    static func main() async throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        let raw = root.appendingPathComponent("camera.raw.mov")
        try FileManager.default.copyItem(at: URL(fileURLWithPath: "/tmp/screenrec-20f-h264-interruption/damaged/source.mov"), to: raw)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let timing = try encoder.encode(await MediaProbe.inspect(url: raw))
        let before = try Data(contentsOf: URL(fileURLWithPath: "/tmp/screenrec-20f-h264-interruption/original-timing.json"))
        precondition(timing == before)
        try timing.write(to: root.appendingPathComponent("timing.json"))
        let asset = AVURLAsset(url: raw)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let cursor = track.makeSampleCursor(presentationTimeStamp: .zero)!
        var inventory: [[String: Any]] = []
        repeat {
            let storage = cursor.currentSampleStorageRange
            precondition(cursor.currentChunkStorageURL == raw)
            inventory.append(["ordinal": inventory.count, "pts": cursor.presentationTimeStamp.value,
                "scale": cursor.presentationTimeStamp.timescale, "duration": cursor.currentSampleDuration.value,
                "durationScale": cursor.currentSampleDuration.timescale,
                "offset": storage.offset, "length": storage.length])
        } while cursor.stepInPresentationOrder(byCount: 1) == 1
        let original = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "/tmp/screenrec-20f-h264-interruption/inventory.json"))) as! [String: Any]
        let expected = (original["samples"] as! [[String: Any]]).map { item in item.filter { $0.key != "units" } }
        let inventoryBytes = try JSONSerialization.data(withJSONObject: inventory, options: [.sortedKeys])
        let expectedBytes = try JSONSerialization.data(withJSONObject: expected, options: [.sortedKeys])
        precondition(inventoryBytes == expectedBytes, "Every native sample timing/storage range must remain identical")
        try inventoryBytes.write(to: root.appendingPathComponent("inventory.json"))
        let binding = CameraCaptureBinding(recordingId: "h264-failure-take", sourceId: "h264-failure-camera", deviceId: "synthetic-device")
        let journal = try CaptureJournal(directory: root.path,
            header: CaptureJournalHeader(schemaVersion: 1, sessionID: binding.sourceId,
                source: CaptureSource(kind: "camera"), width: 34, height: 16,
                microphone: false, systemAudio: false, cameraBinding: binding))
        defer { journal.lease.release() }
        try journal.recordOrigin(hostUs: 1_000_000)
        var rows = Data()
        for ordinal in 0..<3 {
            let row: [String: Any] = ["role": "camera", "disposition": "accepted", "cameraFrame": [
                "ordinal": ordinal,
                "start": ["value": ordinal * 512, "timescale": 15360, "epoch": 0],
                "end": ["value": (ordinal + 1) * 512, "timescale": 15360, "epoch": 0],
            ]]
            rows.append(try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys]) + Data([10]))
        }
        let observations = root.appendingPathComponent(CameraMedia.mappingFile)
        try rows.write(to: observations)
        try CameraMedia.recordClosed(raw: raw, marker: root.appendingPathComponent("camera.closed.json"))
        var observerError: NSError?
        precondition(CameraReadersObserve({}, &observerError), "Unsupported observer ABI: \(String(describing: observerError))")
        var outcome: [String: Any] = [:]
        do {
            let receipt = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
            try encoder.encode(receipt).write(to: root.appendingPathComponent("receipt.json"))
            outcome = ["status": "published", "representedFrames": receipt.representedFrames,
                "pictureSHA256": receipt.pictureSHA256, "diagnostics": receipt.diagnostics]
        } catch let error as CaptureFailure {
            outcome = ["status": "refused", "code": error.code, "message": error.message]
        } catch let error as NativeFailure {
            outcome = ["status": "refused", "code": error.code, "message": error.message]
        } catch {
            let native = error as NSError
            outcome = ["status": "refused", "domain": native.domain, "code": native.code, "message": native.localizedDescription]
        }
        let observation = CameraReadersFinish()!
        precondition(observation["restored"] as? Bool == true && observation["active"] as? Int == 0
            && observation["readingAfterJoin"] as? Int == 0)
        outcome["observation"] = observation
        outcome["publicFile"] = FileManager.default.fileExists(atPath: root.appendingPathComponent("video.mov").path)
        outcome["receipt"] = FileManager.default.fileExists(atPath: root.appendingPathComponent("camera.publication.json").path)
        try JSONSerialization.data(withJSONObject: outcome, options: [.sortedKeys,.prettyPrinted])
            .write(to: root.appendingPathComponent("outcome.json"))
        print("OBSERVED \(String(describing: outcome["status"])); no predetermined decoder outcome")
    }
}
