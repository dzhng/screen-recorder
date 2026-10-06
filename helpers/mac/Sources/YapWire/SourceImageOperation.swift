import YapFrames

enum SourceImageOperation {
    static func execute(_ params: [String: Any]) throws -> SourceImageRenderer.Result {
        let request = try WireRequest.decode(SourceImageRenderer.Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        try WireRequest.requireAbsolute(request.asset.path)
        return try SourceImageRenderer.write(request)
    }
}
