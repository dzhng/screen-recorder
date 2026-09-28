import Darwin
import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

/// Bounded measurements travel in the locked render attempt, not the small command envelope.
enum AcousticImageOperation {
    private struct Request: Codable { let input: String }

    static func execute(_ params: [String: Any]) throws -> AcousticImage.Result {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.input)
        let descriptor = open(request.input, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)
        guard descriptor >= 0 else {
            throw NativeFailure("INVALID_REQUEST", "Cannot open acoustic measurements.")
        }
        defer { close(descriptor) }
        var info = stat()
        guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG else {
            throw NativeFailure("INVALID_REQUEST", "Acoustic measurements must be a regular file.")
        }
        let maximumBytes = 16 * 1024 * 1024
        guard info.st_size > 0, info.st_size <= maximumBytes else {
            throw NativeFailure("LIMIT_EXCEEDED", "Acoustic measurements exceed 16 MiB.")
        }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: false)
        guard let bytes = try handle.read(upToCount: maximumBytes + 1), bytes.count <= maximumBytes else {
            throw NativeFailure("LIMIT_EXCEEDED", "Acoustic measurements exceed 16 MiB.")
        }
        guard let values = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
            throw NativeFailure("INVALID_REQUEST", "Acoustic measurements must be an object.")
        }
        let image = try WireRequest.decode(AcousticImage.Request.self, from: values)
        try WireRequest.requireAbsolute(image.output)
        return try AcousticImage.write(image)
    }
}
