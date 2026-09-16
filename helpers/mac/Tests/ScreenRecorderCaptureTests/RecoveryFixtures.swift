@preconcurrency import AVFoundation
import CoreVideo
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMediaTime

/// Generated media for recovery tests. Frames carry enough detail to encode, nothing more; these
/// tests read timing, never pixels.
enum RecoveryFixture {
    static let width = 160
    static let height = 120

    static func directory(_ name: String) -> URL {
        let url = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("screenrec-\(name)-\(UUID().uuidString)")
        try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func frame(_ seed: Int) -> CVPixelBuffer {
        var created: CVPixelBuffer?
        CVPixelBufferCreate(
            nil, width, height, kCVPixelFormatType_32BGRA,
            [kCVPixelBufferCGImageCompatibilityKey: true] as CFDictionary, &created)
        guard let buffer = created else { preconditionFailure("Cannot allocate a fixture frame") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        let base = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
        for row in 0..<height {
            for column in 0..<bytesPerRow {
                base[row * bytesPerRow + column] = UInt8((row &* 7 &+ column &* 3 &+ seed &* 41) & 0xFF)
            }
        }
        return buffer
    }

    private static func videoInput(keyFrameInterval: Int = 60) -> AVAssetWriterInput {
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoMaxKeyFrameIntervalKey: keyFrameInterval,
                    AVVideoAverageBitRateKey: 2_000_000,
                ],
            ])
        input.expectsMediaDataInRealTime = false
        return input
    }

    /// A finalized take whose frame `i` is presented at `timesUs[i]`, so each sample's duration is
    /// the gap to the next one. Uneven gaps ensure recovery cannot substitute an average frame
    /// duration for the actual last sample.
    static func writeVariableDurationVideo(
        to url: URL, timesUs: [Int64], keyFrameInterval: Int = 60, endUs: Int64? = nil
    ) async throws {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = videoInput(keyFrameInterval: keyFrameInterval)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input, sourcePixelBufferAttributes: nil)
        writer.add(input)
        precondition(writer.startWriting(), "Fixture writer must start")
        writer.startSession(atSourceTime: .zero)
        for (index, us) in timesUs.enumerated() {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 300_000) }
            precondition(
                adaptor.append(frame(index), withPresentationTime: time(microseconds: us)),
                "Fixture frame \(index) must append")
        }
        if let endUs { writer.endSession(atSourceTime: time(microseconds: endUs)) }
        input.markAsFinished()
        await writer.finishWriting()
        precondition(
            writer.status == .completed,
            "Fixture must finalize: \(writer.error?.localizedDescription ?? "")")
    }

    /// Copies a window of `source` into a new file placed at asset time zero. The result carries a
    /// non-identity edit list: its media timestamps stay where they were, its presentation
    /// timestamps start again at zero.
    static func writeTrimmedCopy(of source: URL, to url: URL, mediaWindow: CMTimeRange) async throws {
        try? FileManager.default.removeItem(at: url)
        let asset = AVURLAsset(url: source, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            preconditionFailure("Fixture source must hold a video track")
        }
        let composition = AVMutableComposition()
        guard
            let copy = composition.addMutableTrack(
                withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { preconditionFailure("Cannot add a fixture composition track") }
        try copy.insertTimeRange(mediaWindow, of: track, at: .zero)
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)
        else { preconditionFailure("Cannot export a fixture composition") }
        try await export.export(to: url, as: .mov)
    }

    /// Writes fragmented video the way a take does and abandons the writer without finalizing,
    /// after copying the partial file the way a crashed process leaves it on disk. Returns the
    /// presentation times that were submitted before the copy.
    static func writeCrashedFragmentedVideo(to url: URL, copyTo crashed: URL, timesUs: [Int64])
        async throws -> [Int64]
    {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        writer.movieFragmentInterval = CMTime(value: 5, timescale: 1)
        writer.initialMovieFragmentInterval = CMTime(value: 1, timescale: 1)
        let input = videoInput()
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input, sourcePixelBufferAttributes: nil)
        writer.add(input)
        precondition(writer.startWriting(), "Fixture writer must start")
        writer.startSession(atSourceTime: .zero)
        var submitted: [Int64] = []
        for (index, us) in timesUs.enumerated() {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 300_000) }
            precondition(
                adaptor.append(frame(index), withPresentationTime: time(microseconds: us)),
                "Fixture frame \(index) must append")
            submitted.append(us)
        }
        // Fragments land on the writer's own schedule; wait until the partial file is readable
        // rather than guessing how long that takes.
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            try await Task.sleep(nanoseconds: 200_000_000)
            try? FileManager.default.removeItem(at: crashed)
            guard (try? FileManager.default.copyItem(at: url, to: crashed)) != nil else { continue }
            if await decodedPresentationMicroseconds(of: crashed).isEmpty == false { break }
        }
        precondition(writer.status == .writing, "Fixture must still be mid-write when abandoned")
        writer.cancelWriting()
        return submitted
    }

    /// Every sample presentation timestamp the file decodes, as independent ground truth.
    static func decodedPresentationMicroseconds(of url: URL) async -> [Int64] {
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let track = try? await asset.loadTracks(withMediaType: .video).first,
            let reader = try? AVAssetReader(asset: asset)
        else { return [] }
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        guard reader.canAdd(output) else { return [] }
        reader.add(output)
        guard reader.startReading() else { return [] }
        var times: [Int64] = []
        while let sample = output.copyNextSampleBuffer() {
            times.append(microseconds(CMSampleBufferGetPresentationTimeStamp(sample)))
        }
        return times
    }

    /// Interval bounds as plain numbers, so tests state expectations without building response types.
    static func bounds(_ intervals: [MediaInterval]) -> [[Int64]] {
        intervals.map { [$0.startUs, $0.endUs] }
    }

    static func videoTrack(of url: URL) async -> AVAssetTrack {
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let track = try? await asset.loadTracks(withMediaType: .video).first else {
            preconditionFailure("Fixture must hold a video track: \(url.path)")
        }
        return track
    }
}
