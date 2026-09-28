import ScreenRecorderFrames

enum CompositionFrameOperation {
    static func execute(_ params: [String: Any]) async throws -> CompositionFrameRenderer.Result {
        let request = try WireRequest.decode(CompositionFrameRenderer.Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        for asset in request.assets { try WireRequest.requireAbsolute(asset.path) }
        return try await CompositionFrameRenderer.write(request)
    }
}
