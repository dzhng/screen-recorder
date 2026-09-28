import CoreGraphics
import CoreText
import Foundation
import ScreenRecorderMedia

/// Draws already measured evidence. It never opens media, resamples audio, or mixes channels.
public enum AcousticImage {
    public struct Span: Codable {
        let start: Int64
        let end: Int64
    }
    public struct Column: Codable {
        let range: Span
        let partial: Bool
        // Waveform: min/max/RMS per channel. Spectrum: linear PSD bins per channel.
        let values: [[Double]]
    }
    public struct Request: Codable {
        public let output: String
        let kind: String
        let domain: String
        let provenance: [String]
        let sampleRate: Int
        let channels: Int
        let range: Span
        let columns: [Column]
        let unavailable: [Span]
        let bins: Int?
        let binHz: Double?
    }
    public struct Result: Encodable {
        let file: String
        let mediaType = "image/png"
        let width: Int
        let height: Int
        let bytes: Int
        let provenance: [String]
        let plotLeft = 92
        let plotWidth = 1080
        let panelHeight = 180
        let panelStride = 244
        let plotTop = 164
        let amplitudeLimit: Double?
        let densityFloorDb: Double?
        let densityCeilingDb: Double?
    }
    public static func write(_ r: Request) throws -> Result {
        let wave = r.kind == "waveform"
        guard wave || r.kind == "spectrum", ["source", "project"].contains(r.domain),
            (1...8).contains(r.channels), (1...768000).contains(r.sampleRate),
            r.range.start >= 0, r.range.end > r.range.start,
            r.range.end <= 9_007_199_254_740_991,
            !r.provenance.isEmpty, r.provenance.count <= 4,
            r.provenance.allSatisfy({ !$0.isEmpty }),
            r.provenance.reduce(0, { $0 + $1.utf8.count }) <= 1_048_576,
            !r.columns.isEmpty, r.columns.count <= 4096, r.unavailable.count <= 4096
        else {
            throw NativeFailure(
                "INVALID_REQUEST", "Invalid bounded acoustic image dimensions or labels.")
        }
        let bins = wave ? 3 : (r.bins ?? 0)
        guard
            (wave && r.bins == nil && r.binHz == nil)
                || (bins >= 9 && bins <= 4097 && (r.binHz ?? 0).isFinite && (r.binHz ?? 0) > 0
                    && abs(Double(bins - 1) * r.binHz! - Double(r.sampleRate) / 2) < 0.000001),
            r.columns.count * r.channels * bins <= 262144
        else {
            throw NativeFailure(
                "LIMIT_EXCEEDED", "Invalid acoustic matrix or more than 262144 cells.")
        }
        var cursor = r.range.start
        var peak = 0.0
        for column in r.columns {
            guard column.range.start == cursor, column.range.end > cursor,
                column.range.end <= r.range.end, column.values.count == r.channels,
                column.values.allSatisfy({ $0.count == bins && $0.allSatisfy(\.isFinite) })
            else {
                throw NativeFailure(
                    "INVALID_REQUEST", "Acoustic columns must partition the displayed sample range."
                )
            }
            for values in column.values {
                if wave {
                    guard values[0] <= values[1], values[2] >= 0,
                        values[2] <= max(abs(values[0]), abs(values[1])) + 1e-9
                    else {
                        throw NativeFailure("INVALID_REQUEST", "Invalid waveform extrema or RMS.")
                    }
                    peak = max(peak, abs(values[0]), abs(values[1]))
                } else if values.contains(where: { $0 < 0 }) {
                    throw NativeFailure("INVALID_REQUEST", "Spectral density cannot be negative.")
                }
            }
            cursor = column.range.end
        }
        guard cursor == r.range.end else {
            throw NativeFailure("INVALID_REQUEST", "Incomplete acoustic columns.")
        }
        peak = max(1, peak * 1.05)
        cursor = r.range.start
        for span in r.unavailable {
            guard span.start >= cursor, span.end > span.start, span.end <= r.range.end else {
                throw NativeFailure("INVALID_REQUEST", "Invalid unavailable support.")
            }
            cursor = span.end
        }
        let width = 1240
        let height = 164 + r.channels * 244 + 58
        guard
            let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else {
            throw NativeFailure.decodeFailed("Cannot create acoustic image context.")
        }
        func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1)
            -> CGColor
        {
            CGColor(srgbRed: red, green: green, blue: blue, alpha: alpha)
        }
        func fill(_ rect: CGRect, _ value: CGColor) {
            context.setFillColor(value)
            context.fill(rect)
        }
        func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat = 13) {
            let attributes: [NSAttributedString.Key: Any] = [
                NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName(
                    "Menlo" as CFString, size, nil),
                NSAttributedString.Key(kCTForegroundColorAttributeName as String): color(
                    0.12, 0.18, 0.24),
            ]
            let display = String(value.prefix(400)).unicodeScalars.map {
                $0.properties.generalCategory == .control
                    ? String(format: "\\u%04X", $0.value) : String($0)
            }.joined()
            var line = CTLineCreateWithAttributedString(
                NSAttributedString(string: display, attributes: attributes))
            if value.count > 400 || CTLineGetTypographicBounds(line, nil, nil, nil) > 1180 {
                let token = CTLineCreateWithAttributedString(
                    NSAttributedString(
                        string: "… [full text in receipt]", attributes: attributes))
                line = CTLineCreateTruncatedLine(line, 1180, .end, token) ?? token
            }
            let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
            context.textPosition = CGPoint(x: max(12, min(x, 1228 - width)), y: y)
            CTLineDraw(line, context)
        }
        fill(CGRect(x: 0, y: 0, width: width, height: height), color(0.98, 0.985, 0.99))
        text(
            wave
                ? "WAVEFORM  |  blue min/max envelope + dark RMS"
                : "SPECTROGRAM  |  one-sided power spectral density", 24, CGFloat(height - 30), 18)
        text(
            "\(r.domain) time (seconds)  |  \(r.sampleRate) Hz  |  \(r.channels) channel\(r.channels == 1 ? "" : "s")", 24,
            CGFloat(height - 54))
        for (i, label) in r.provenance.enumerated() {
            text(label, 24, CGFloat(height - 76 - 18 * i), 11)
        }
        let span = Double(r.range.end - r.range.start)
        func x(_ sample: Int64) -> CGFloat {
            92 + 1080 * CGFloat(Double(sample - r.range.start) / span)
        }
        let floorDb = -120.0
        let ceilingDb = 0.0
        for channel in 0..<r.channels {
            try Task.checkCancellation()
            let bottom = CGFloat(height - 164 - channel * 244 - 180)
            let plot = CGRect(x: 92, y: bottom, width: 1080, height: 180)
            fill(plot, wave ? color(1, 1, 1) : color(0.025, 0.04, 0.09))
            text(
                "Channel \(channel + 1)  |  "
                    + (wave ? "amplitude (full scale)" : "frequency (Hz)"), 92,
                bottom + 190)
            // Max pooling in both raster dimensions keeps subpixel impulses and narrow tones visible.
            var densityPixels = wave ? [] : [Double](repeating: 0, count: 1080 * 180)
            if !wave {
                for column in r.columns {
                    try Task.checkCancellation()
                    let first = max(0, Int(floor(x(column.range.start) - 92)))
                    let last = min(1080, Int(ceil(x(column.range.end) - 92)))
                    for (bin, value) in column.values[channel].enumerated() {
                        let low = max(0, Int(floor(180 * (Double(bin) - 0.5) / Double(bins - 1))))
                        let high = min(180, Int(ceil(180 * (Double(bin) + 0.5) / Double(bins - 1))))
                        for py in low..<high {
                            for px in first..<last {
                                densityPixels[py * 1080 + px] = max(
                                    densityPixels[py * 1080 + px], value)
                            }
                        }
                    }
                }
                for py in 0..<180 {
                    for px in 0..<1080 {
                        let value = densityPixels[py * 1080 + px]
                        let db = value > 0 ? 10 * log10(value) : floorDb
                        let t = CGFloat(max(0, min(1, (db - floorDb) / (ceilingDb - floorDb))))
                        fill(
                            CGRect(
                                x: CGFloat(92 + px), y: bottom + CGFloat(py), width: 1, height: 1),
                            color(t, t * t, 0.12 + 0.3 * (1 - t)))
                    }
                }
            }
            if !wave {
                for py in 0..<180 {
                    let t = CGFloat(py) / 179
                    fill(
                        CGRect(x: 1186, y: bottom + CGFloat(py), width: 12, height: 1),
                        color(t, t * t, 0.12 + 0.3 * (1 - t)))
                }
                text("dB", 1184, bottom + 190, 10)
                for (row, label) in [(0, "-120"), (90, "-60"), (180, "0")] {
                    text(label, 1202, bottom + CGFloat(row) - 3, 9)
                }
            }
            context.saveGState()
            context.clip(to: plot)
            for column in r.columns {
                let left = x(column.range.start)
                let right = x(column.range.end)
                let values = column.values[channel]
                if wave {
                    let low = bottom + 90 + CGFloat(values[0] / peak) * 90
                    let high = bottom + 90 + CGFloat(values[1] / peak) * 90
                    fill(
                        CGRect(
                            x: left, y: low, width: max(1, right - left), height: max(1, high - low)
                        ),
                        color(0.14, 0.43, 0.65))
                    let rms = CGFloat(values[2] / peak) * 90
                    fill(
                        CGRect(
                            x: left, y: bottom + 90 - rms, width: max(1, right - left),
                            height: max(1, rms * 2)),
                        color(0.02, 0.23, 0.36, 0.55))
                }
                if column.partial {
                    fill(
                        CGRect(x: left, y: bottom + 176, width: max(1, right - left), height: 4),
                        color(0.9, 0.5, 0.04))
                }
            }
            for unavailable in r.unavailable {
                let gap = CGRect(
                    x: x(unavailable.start), y: bottom,
                    width: x(unavailable.end) - x(unavailable.start),
                    height: 180)
                fill(gap, color(0.55, 0.55, 0.55, 0.6))
            }
            context.restoreGState()
            context.setStrokeColor(color(0.45, 0.5, 0.56))
            context.setLineWidth(0.5)
            context.stroke(plot)
            for tick in 0...4 {
                let tx = CGFloat(92 + tick * 270)
                let seconds =
                    (Double(r.range.start) + span * Double(tick) / 4) / Double(r.sampleRate)
                text(String(format: "%.6f", seconds), tx - 30, bottom - 20, 11)
                let value =
                    wave
                    ? -peak + 2 * peak * Double(tick) / 4
                    : Double(r.sampleRate) / 2 * Double(tick) / 4
                text(String(format: wave ? "%.3g" : "%.0f", value), 24, bottom + CGFloat(tick * 45) - 4, 11)
            }
        }
        text(
            wave
                ? "Shared amplitude scale +/-\(String(format: "%.3g", peak)); no display clipping or channel mixing."
                : "PSD: -120 to 0 dB re 1 FS²/Hz (dark to yellow); max per pixel; display limits only.",
            24,
            36, 11)
        text(
            "Orange: clipped bucket / incomplete FFT. Grey: incomplete source support; other sources may still sound.",
            24, 17, 11)
        guard let image = context.makeImage() else {
            throw NativeFailure.decodeFailed("Cannot finish acoustic image.")
        }
        let output = try NewFile(at: r.output, assembledAs: "acoustic.png")
        defer { output.discard() }
        let bytes = try publishPNGData(
            encodePNG(image), to: output, maxEncodedBytes: 16 * 1024 * 1024)
        return Result(
            file: r.output, width: width, height: height, bytes: bytes, provenance: r.provenance,
            amplitudeLimit: wave ? peak : nil, densityFloorDb: wave ? nil : floorDb,
            densityCeilingDb: wave ? nil : ceilingDb)
    }
}
