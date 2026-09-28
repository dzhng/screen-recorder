import ScreenRecorderFrames

enum SourceVisualSamplesOperation {
    static func execute(_ params: [String: Any]) async throws -> SourceVisualSamples.Result {
        let request = try WireRequest.decode(SourceVisualSamples.Request.self, from: params)
        try WireRequest.requireAbsolute(request.asset.path)
        return try await SourceVisualSamples.read(request)
    }
}
