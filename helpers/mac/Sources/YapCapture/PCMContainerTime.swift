import CoreMedia

/// Exact container coordinates for a fixed admitted phase and native sample grid.
/// Admission and materialization use the same capacity check, without another timing quantizer.
package struct PCMContainerTime: Sendable {
    package let timescale: Int32
    private let phaseUs: Int64
    private let rate: Int32

    package init(phaseUs: Int64, rate: Int32) throws {
        guard phaseUs >= 0, rate > 0 else {
            throw CaptureFailure("INVALID_AUDIO_TIMING", "Invalid native PCM phase or rate.")
        }
        func gcd(_ first: Int64, _ second: Int64) -> Int64 {
            var a = first, b = second
            while b != 0 { (a, b) = (b, a % b) }
            return a
        }
        let phaseScale = 1_000_000 / gcd(phaseUs, 1_000_000)
        let divisor = gcd(Int64(rate), phaseScale)
        guard let scale = Int32(exactly: Int64(rate) / divisor * phaseScale) else {
            throw CaptureFailure("INVALID_AUDIO_TIMING",
                "PCM phase cannot be represented exactly by this container timescale.")
        }
        self.timescale = scale
        self.phaseUs = phaseUs
        self.rate = rate
    }

    package func time(at frame: Int64) throws -> CMTime {
        let value = Int128(phaseUs) * Int128(timescale) / 1_000_000
            + Int128(frame) * Int128(timescale / rate)
        guard frame >= 0, let value = Int64(exactly: value) else {
            throw CaptureFailure("INVALID_AUDIO_TIMING", "PCM timing exceeds container capacity.")
        }
        return CMTime(value: value, timescale: timescale)
    }
}
