import CryptoKit
import Foundation

public struct LUTAssetBinding: Codable, Sendable {
    public let assetId: String
    public let path: String
}

/// Bounded .cube 3D samples, red changing fastest. Color interpretation belongs to the explicit step.
public struct CubeLUT {
    public struct Metadata: Encodable, Sendable {
        public let format = "cube-3d"
        public let size: Int
        public let domain = "unit"
        public let ordering = "red-fastest"
    }
    public static let maximumBytes = 4 * 1024 * 1024
    public let metadata: Metadata
    public let rgba: [Float]
    public let isIdentity: Bool
    public init(data: Data) throws {
        guard data.count <= Self.maximumBytes, let text = String(data: data, encoding: .utf8),
            !text.contains("\0") else { throw Self.invalid("LUT must be bounded UTF-8 .cube text.") }
        var size: Int?, minimum = false, maximum = false, title = false
        var samples: [Float] = []
        for raw in text.components(separatedBy: .newlines) {
            let line = raw.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)[0]
                .trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            let fields = line.split(whereSeparator: { $0.isWhitespace })
            let header = String(fields[0])
            if header == "TITLE" {
                guard samples.isEmpty, !title, line.dropFirst(5).trimmingCharacters(in: .whitespaces).first == "\"", line.last == "\"" else {
                    throw Self.invalid("LUT TITLE must be one quoted header before samples.")
                }
                title = true
            } else if header == "LUT_3D_SIZE" {
                guard samples.isEmpty, size == nil, fields.count == 2,
                    let value = Int(fields[1]), (2...33).contains(value) else {
                    throw Self.invalid("LUT_3D_SIZE must be one integer from 2 through 33.")
                }
                size = value
            } else if header == "DOMAIN_MIN" || header == "DOMAIN_MAX" {
                let isMinimum = header == "DOMAIN_MIN"
                guard samples.isEmpty, fields.count == 4, !(isMinimum ? minimum : maximum),
                    fields.dropFirst().allSatisfy({ Double($0) == (isMinimum ? 0 : 1) }) else {
                    throw Self.invalid("Only the unit LUT domain is supported.")
                }
                if isMinimum { minimum = true } else { maximum = true }
            } else {
                guard let size, fields.count == 3, samples.count < size * size * size * 4 else {
                    throw Self.invalid("Unknown LUT transform or invalid grid length.")
                }
                for field in fields {
                    guard let value = Float(field), value.isFinite, (0...1).contains(value) else {
                        throw Self.invalid("LUT output samples must be finite RGB in [0,1].")
                    }
                    samples.append(value)
                }
                samples.append(1)
            }
        }
        guard let size, samples.count == size * size * size * 4 else {
            throw Self.invalid("LUT grid must contain exactly size cubed RGB rows.")
        }
        metadata = Metadata(size: size)
        rgba = samples
        isIdentity = (0..<(size * size * size)).allSatisfy { index in
            let r = index % size, g = (index / size) % size, b = index / (size * size)
            return samples[index * 4] == Float(r) / Float(size - 1)
                && samples[index * 4 + 1] == Float(g) / Float(size - 1)
                && samples[index * 4 + 2] == Float(b) / Float(size - 1)
        }
    }
    public static func load(_ binding: LUTAssetBinding) throws -> Self {
        let data = try read(URL(fileURLWithPath: binding.path))
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard digest == binding.assetId else { throw NativeFailure("UNSUPPORTED_MEDIA", "LUT_CHANGED") }
        return try Self(data: data)
    }
    public static func inspect(url: URL) throws -> Metadata? {
        guard url.pathExtension.lowercased() == "cube" else { return nil }
        return try Self(data: read(url)).metadata
    }
    private static func read(_ url: URL) throws -> Data {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        let data = try file.read(upToCount: maximumBytes + 1) ?? Data()
        guard data.count <= maximumBytes else { throw invalid("LUT exceeds the 4 MiB byte bound.") }
        return data
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("UNSUPPORTED_MEDIA", message)
    }
}
