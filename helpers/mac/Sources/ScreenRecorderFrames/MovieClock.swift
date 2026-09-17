@preconcurrency import AVFoundation
import ScreenRecorderMedia

/// A common exact clock for cuts, presentation support, pointer states and final mux.
/// Failure is explicit: converting with a rounding mode is never permission to round.
public struct MovieClock {
    public private(set) var timescale: Int32 = 1_000_000
    public init() {}

    public mutating func include(_ scale: Int32) throws {
        guard scale > 0 else { throw Self.failure() }
        var a = Int64(timescale)
        var b = Int64(scale)
        while b != 0 { (a, b) = (b, a % b) }
        let next = Int64(timescale) / a * Int64(scale)
        guard next <= Int64(Int32.max) else { throw Self.failure() }
        timescale = Int32(next)
    }

    public mutating func include(_ time: CMTime) throws {
        guard time.isNumeric, time.value >= 0 else { throw Self.failure() }
        var a = time.value
        var b = Int64(time.timescale)
        while b != 0 { (a, b) = (b, a % b) }
        try include(Int32(Int64(time.timescale) / a))
    }

    public func exact(_ time: CMTime) throws -> CMTime {
        let result = CMTimeConvertScale(time, timescale: timescale, method: .roundTowardZero)
        guard time.isNumeric, result.isNumeric, CMTimeCompare(time, result) == 0 else {
            throw Self.failure()
        }
        return result
    }

    private static func failure() -> NativeFailure {
        NativeFailure(
            "UNSUPPORTED_CLOCK", "Movie clock cannot represent required transitions exactly.")
    }
}
