import YapFrames

enum CompositionFrameOperation {
    static func execute(_ params: [String: Any]) async throws -> CompositionFrameRenderer.Result {
        let request = try WireRequest.decode(CompositionFrameRenderer.Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        for asset in request.assets { try WireRequest.requireAbsolute(asset.path) }
        for font in request.fonts ?? [] { try WireRequest.requireAbsolute(font.path) }
        for lut in request.luts ?? [] { try WireRequest.requireAbsolute(lut.path) }
        return try await CompositionFrameRenderer.write(request)
    }
}
