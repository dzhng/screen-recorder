import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

/// Cancels actual native work after bytes reach staging, rather than before admission.
func verifyPresentationLifetime(source: URL, parent: URL) async throws {
    let directory = parent.appendingPathComponent("presentation-lifetime-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let rows = (0..<10_000).map { index in
        [
            "source": ["startUs": index * 2, "endUs": index * 2 + 1],
            "playback": ["startUs": index, "endUs": index + 1],
        ]
    }
    let plan = try JSONDecoder().decode(
        [VideoRenderSpan].self,
        from: JSONSerialization.data(withJSONObject: rows))
    for cancel in [true, false] {
        let output = directory.appendingPathComponent(cancel ? "canceled.jsonl" : "raced.jsonl")
        let task = Task.detached {
            try await PresentationEvidence.write(
                source: source, plan: plan,
                output: output, maxBytes: 256 * 1024 * 1024)
        }
        let deadline = ContinuousClock.now.advanced(by: .seconds(10))
        while true {
            let staging = try FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: nil
            )
            .first { $0.lastPathComponent.hasPrefix(".presentation-evidence-") }
            if let staging,
                let attributes = try? FileManager.default.attributesOfItem(
                    atPath: staging.appendingPathComponent("evidence.jsonl").path),
                let bytes = attributes[.size] as? Int, bytes > 1000
            {
                break
            }
            guard ContinuousClock.now < deadline else {
                task.cancel()
                _ = try? await task.value
                preconditionFailure("Evidence did not make bounded forward progress")
            }
            try await Task.sleep(for: .milliseconds(2))
        }
        if cancel {
            task.cancel()
        } else {
            try Data("unrelated destination".utf8).write(to: output, options: .withoutOverwriting)
        }
        do {
            _ = try await task.value
            preconditionFailure("Canceled/raced evidence must not publish")
        } catch is CancellationError {
            precondition(cancel)
        } catch let error as NativeFailure {
            precondition(!cancel && error.code == "INVALID_OUTPUT", "\(error)")
        }
        let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        precondition(!remaining.contains { $0.hasPrefix(".presentation-evidence-") })
        if cancel {
            precondition(!FileManager.default.fileExists(atPath: output.path))
        } else {
            let bytes = try Data(contentsOf: output)
            precondition(bytes == Data("unrelated destination".utf8))
        }
    }
    print("PASS presentation evidence cancellation removes staging and publication preserves races")
}
