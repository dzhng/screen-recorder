import Foundation

/// The one failure a native worker operation reports. `retryable` states whether the identical
/// request can succeed later without the caller changing it: media that failed to decode or a
/// transient filesystem error can, a malformed request or a changed identity cannot.
public struct NativeFailure: Error, LocalizedError, Sendable, Equatable {
    public let code: String
    public let message: String
    public let retryable: Bool
    public var errorDescription: String? { message }

    public init(_ code: String, _ message: String, retryable: Bool = false) {
        self.code = code
        self.message = message
        self.retryable = retryable
    }

    /// Media could not be opened, decoded, encoded or written by the platform.
    public static func decodeFailed(_ message: String) -> NativeFailure {
        NativeFailure("NATIVE_DECODE_FAILED", message, retryable: true)
    }
}
