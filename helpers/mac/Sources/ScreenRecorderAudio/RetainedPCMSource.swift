import Darwin
import Foundation
import ScreenRecorderMedia

/// Already validated Float32 output, borrowed from its immutable owner. No decoder or resampler.
public final class RetainedPCMSource: AudioPCMSource {
    public let format = AudioPCMFormat(sampleRate: 48_000, channels: 2, layout: .stereo)
    public private(set) var report: CompositionAudioReport?
    private let fd: Int32
    private let offset: Int64
    private let range: CompositionAudioPlan.Samples
    private let unavailable: [CompositionAudioReport.Missing]
    private let initial: stat
    private var consumed = false

    public init(descriptor: Int32, bytes: Int64, dataOffset: Int64, frames: Int64,
                range: CompositionAudioPlan.Samples, unavailable: [CompositionAudioReport.Missing]) throws {
        var info = stat()
        guard descriptor >= 3, fstat(descriptor, &info) == 0,
              info.st_mode & S_IFMT == S_IFREG, info.st_size == bytes,
              dataOffset >= 12, frames > 0,
              Int128(dataOffset) + Int128(frames) * 8 <= Int128(bytes),
              range.start >= 0, range.end > range.start, range.end <= frames else {
            throw NativeFailure("INVALID_REQUEST", "Retained PCM dimensions or descriptor are invalid.")
        }
        let copied = fcntl(descriptor, F_DUPFD_CLOEXEC, 3)
        guard copied >= 0 else { throw NativeFailure("IO_ERROR", "Cannot retain prepared PCM descriptor.") }
        fd = copied
        initial = info
        offset = dataOffset
        self.range = range
        self.unavailable = unavailable
    }
    deinit { Darwin.close(fd) }

    private func checkIdentity() throws {
        var now = stat()
        guard fstat(fd, &now) == 0, now.st_dev == initial.st_dev, now.st_ino == initial.st_ino,
              now.st_size == initial.st_size,
              now.st_mtimespec.tv_sec == initial.st_mtimespec.tv_sec,
              now.st_mtimespec.tv_nsec == initial.st_mtimespec.tv_nsec,
              now.st_ctimespec.tv_sec == initial.st_ctimespec.tv_sec,
              now.st_ctimespec.tv_nsec == initial.st_ctimespec.tv_nsec else {
            throw NativeFailure("ARTIFACT_CHANGED", "Retained PCM changed during consumption.")
        }
    }
    public var frameCount: Int64 { range.end - range.start }
    public func readFrames(position: Int64, count: Int) throws -> [Float] {
        guard position >= range.start, count >= 0, Int128(position) + Int128(count) <= Int128(range.end) else {
            throw NativeFailure("INVALID_REQUEST", "Retained PCM read exceeds its selected frames.")
        }
        try checkIdentity()
        var samples = [Float](repeating: 0, count: count * 2)
        try samples.withUnsafeMutableBytes { buffer in
            var copied = 0
            while copied < buffer.count {
                let read = pread(fd, buffer.baseAddress!.advanced(by: copied), buffer.count - copied,
                                 offset + position * 8 + Int64(copied))
                if read < 0 && errno == EINTR { continue }
                guard read > 0 else { throw NativeFailure("ARTIFACT_CHANGED", "Retained PCM ended before its pinned frame count.") }
                copied += read
            }
        }
        guard samples.allSatisfy({ $0.isFinite }) else {
            throw NativeFailure("INVALID_RESPONSE", "Retained PCM contains non-finite samples.")
        }
        try checkIdentity()
        return samples
    }
    public func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws {
        guard !consumed else { throw NativeFailure("INVALID_REQUEST", "Retained PCM has already been consumed.") }
        consumed = true
        var position = range.start
        var peak = 0.0
        var clipped: Int64 = 0
        while position < range.end {
            try Task.checkCancellation()
            let count = Int(min(8192, range.end - position))
            let samples = try readFrames(position: position, count: count)
            for sample in samples {
                peak = max(peak, abs(Double(sample)))
                if abs(sample) > 1 { clipped += 1 }
            }
            try await sink(AudioPCMBlock(startFrame: position - range.start, frameCount: count, samples: samples))
            position += Int64(count)
        }
        try Task.checkCancellation()
        try checkIdentity()
        report = CompositionAudioReport(sampleRate: 48_000, channels: 2, frames: range.end - range.start,
            peak: peak, clippedSamples: clipped, maximumBlockFrames: Int(min(8192, range.end - range.start)),
            peakResidentBytes: ProcessResources.peakResidentBytes(),
            decoderContext: .init(policy: "bounded-current-retained-run", sampleRate: 48_000,
                                  maximumPrerollFrames: 0, maximumTailFrames: 0),
            sourceWork: .init(preparedRetimeRuns: 0, decoded: [], descriptorReadBytes: 0, descriptorDeliveredBytes: 0,
                              descriptorInputs: 0, unknownReadInputs: 1), unavailable: unavailable)
    }
    public func write(to output: URL) async throws -> CompositionAudioResult {
        let writer = try AudioWaveWriter(sampleRate: 48_000, frames: range.end - range.start,
                                        channels: 2, output: output, sources: [])
        defer { writer.discard() }
        try await consume { try writer.write($0) }
        return CompositionAudioResult(file: output.path, bytes: try writer.finish(), report: report!)
    }
}
