@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

func verifySourceSceneBounds(source: URL) async throws {
    let presentation = try await PresentationSource(source: source, streamId: nil, startUs: 0)
    _ = try presentation.selection(at: .zero, end: .positiveInfinity, maximumDecodedSamples: 1)
    do {
        _ = try presentation.selection(at: time(microseconds: 200_000), end: .positiveInfinity,
            maximumDecodedSamples: 1)
        preconditionFailure("Scene decode budget must refuse before another decode")
    } catch let error as NativeFailure {
        precondition(error.code == "LIMIT_EXCEEDED", "\(error)")
        precondition(presentation.decodedCount == 1)
    }
    // The same reader still works for callers that did not opt into the inspection budget.
    let resumed = try presentation.selection(at: time(microseconds: 200_000), end: .positiveInfinity)
    precondition(resumed.sampleTime == time(microseconds: 200_000))
    let body: [String: Any] = [
        "asset": ["assetId": "fixture", "streamId": "track:1", "path": source.path, "originUs": 0],
        "available": [["startUs": 0, "endUs": 1_000_000]], "atSourceUs": [0, 200_000]
    ]
    let request = try JSONDecoder().decode(SourceVisualSamples.Request.self,
        from: JSONSerialization.data(withJSONObject: body))
    let task = Task {
        withUnsafeCurrentTask { $0?.cancel() }
        _ = try await SourceVisualSamples.read(request)
    }
    do {
        _ = try await task.value
        preconditionFailure("Canceled source observation must refuse before reading")
    } catch is CancellationError {}
    print("PASS selected scene decode budget, unrestricted reuse and pre-read cancellation")
}
