import Darwin
import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

enum CompositionVideoOperation {
    static func execute(_ params: [String: Any]) async throws -> CompositionVideoRenderer.Result {
        let request = try WireRequest.decode(CompositionVideoRenderer.Request.self, from: params)
        try WireRequest.requireAbsolute(request.output, request.frames)
        for asset in request.assets { try WireRequest.requireAbsolute(asset.path) }
        let records = try FrameRecords(request.frames)
        defer { records.close() }
        return try await CompositionVideoRenderer.write(request, nextFrame: records.next)
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    final class FrameRecords {
        let file: FileHandle
        var buffer = Data(), offset = 0
        init(_ path: String) throws {
            let descriptor = open(path, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC)
            guard descriptor >= 0 else { throw invalid("Cannot open compiled frame file.") }
            var info = stat()
            guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG else {
                Darwin.close(descriptor)
                throw invalid("Compiled frames must be a regular file.")
            }
            file = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        }
        func close() { try? file.close() }
        func next() throws -> CompositionPictureExecutor.Frame? {
            while true {
                if let end = buffer[offset...].firstIndex(of: 10) {
                    let data = buffer.subdata(in: offset..<end)
                    offset = end + 1
                    guard !data.isEmpty, data.count < 65_536,
                        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                    else { throw invalid("Invalid compiled frame record.") }
                    return try WireRequest.decode(CompositionPictureExecutor.Frame.self, from: object)
                }
                if offset > 0 {
                    buffer.removeSubrange(0..<offset)
                    offset = 0
                }
                guard buffer.count < 65_536 else {
                    throw invalid("Compiled frame record exceeds 65535 bytes.")
                }
                let chunk = try file.read(upToCount: min(16_384, 65_536 - buffer.count)) ?? Data()
                if chunk.isEmpty {
                    guard buffer.isEmpty else {
                        throw invalid("Unterminated compiled frame record.")
                    }
                    return nil
                }
                buffer.append(chunk)
            }
        }
    }
}
