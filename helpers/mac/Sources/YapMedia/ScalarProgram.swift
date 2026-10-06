import Foundation

/// Numerical coefficients and a global sample clock compiled by the composition owner.
public struct ScalarSampleProgram: Codable, Sendable {
    public let pieces: [Piece]

    public struct Piece: Codable, Sendable {
        let start: Int64
        let end: Int64
        let origin: Int64
        let offset: Double
        let slope: Double
        let kernel: Kernel
    }

    public struct Kernel: Codable, Sendable {
        let kind: String
        let value: Double?
        let from: Double?
        let to: Double?
        let lower: Double?
        let upper: Double?
        let time: [Double]?
        let weight: [Double]?
        let weightOrigin: Double?
        let weightScale: Double?

        var valid: Bool {
            if kind == "constant" { return value?.isFinite == true }
            guard from?.isFinite == true, to?.isFinite == true else { return false }
            if kind == "linear" { return true }
            guard kind == "parametric", let lower, let upper,
                lower.isFinite, upper.isFinite, lower < upper,
                let time, time.count == 3, time.allSatisfy(\.isFinite),
                let weight, weight.count == 3, weight.allSatisfy(\.isFinite),
                weightOrigin?.isFinite == true, let weightScale,
                weightScale.isFinite, weightScale > 0
            else { return false }
            return true
        }

        func evaluate(_ phase: Double) -> Double {
            if kind == "constant" { return value! }
            var amount = phase
            if kind == "parametric" {
                if phase == 0 && lower == 0 { return from! }
                if phase == 0 && upper == 0 { return to! }
                var lo = lower!, hi = upper!
                for _ in 0..<1076 {
                    let middle = (lo + hi) / 2
                    if middle == lo || middle == hi { break }
                    let x = polynomial(time!, middle)
                    if x == phase { lo = middle; hi = middle; break }
                    if x < phase { lo = middle } else { hi = middle }
                }
                amount = (polynomial(weight!, (lo + hi) / 2) + weightOrigin!) * weightScale!
            }
            return (1 - amount) * from! + amount * to!
        }
        private func polynomial(_ coefficients: [Double], _ value: Double) -> Double {
            ((coefficients[0] * value + coefficients[1]) * value + coefficients[2]) * value
        }
    }

    public func validate() throws {
        var end: Int64 = 0
        for piece in pieces {
            guard piece.start == end, piece.end > piece.start,
                piece.end <= TimeSpan.maximumMicroseconds,
                piece.origin >= 0, piece.origin <= TimeSpan.maximumMicroseconds,
                piece.offset.isFinite, piece.slope.isFinite, piece.slope >= 0,
                piece.kernel.valid
            else { throw NativeFailure("INVALID_REQUEST", "Invalid scalar sample program.") }
            end = piece.end
        }
        guard end == TimeSpan.maximumMicroseconds else {
            throw NativeFailure("INVALID_REQUEST", "Incomplete scalar sample program.")
        }
    }

    public func sample(_ frame: Int64) -> Double {
        var lower = 0, upper = pieces.count
        while lower < upper {
            let middle = (lower + upper) / 2
            if pieces[middle].end <= frame { lower = middle + 1 } else { upper = middle }
        }
        let piece = pieces[lower]
        let phase = piece.offset + Double(frame - piece.origin) * piece.slope
        return piece.kernel.evaluate(phase)
    }
}

public enum SampleScalar: Codable, Sendable {
    case constant(Double)
    case program(ScalarSampleProgram)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Double.self) { self = .constant(value) }
        else { self = .program(try container.decode(ScalarSampleProgram.self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .constant(let value): try container.encode(value)
        case .program(let program): try container.encode(program)
        }
    }
    public var constant: Double? {
        if case .constant(let value) = self { return value }
        return nil
    }
    public func sample(_ frame: Int64) -> Double {
        switch self {
        case .constant(let value): return value
        case .program(let program): return program.sample(frame)
        }
    }
}
