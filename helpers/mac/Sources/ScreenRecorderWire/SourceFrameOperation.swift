import ScreenRecorderFrames

enum SourceFrameOperation {
    static func execute(_ params: [String: Any]) async throws -> SourceFrameRenderer.Result {
        let request = try WireRequest.decode(SourceFrameRenderer.Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        try WireRequest.requireAbsolute(request.asset.path)
        return try await SourceFrameRenderer.write(request)
    }
}
