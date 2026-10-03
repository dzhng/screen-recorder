import ScreenRecorderMedia

/// Shared movie/codec timescale. Refuse clocks whose exact common scale exceeds the SDK limit.
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

    private static func failure() -> NativeFailure {
        NativeFailure(
            "UNSUPPORTED_CLOCK", "Movie clock cannot represent required transitions exactly.")
    }
}
