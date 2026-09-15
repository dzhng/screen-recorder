@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMediaTime

/// The single owner of native audio excerpt execution. It reads the retained source spans the
/// timeline owner resolved, concatenates exactly those spans, and writes one lossless PCM file.
/// It never resolves revisions, infers edits, or moves a requested boundary.
public enum AudioExcerpts {
    public static func write(_ request: AudioExcerptRequest) async throws -> AudioExcerpt {
        try ExcerptValidation.check(request)
        var tracks: [SourceTrack] = []
        for plan in request.tracks { tracks.append(try await SourceTrack.open(plan: plan)) }
        let destination = request.output.resolvingSymlinksInPath().standardizedFileURL
        for track in tracks where track.url == destination {
            throw AudioFailure("INVALID_OUTPUT", "Excerpt output would overwrite the source media.")
        }
        var outputIsDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: request.output.path, isDirectory: &outputIsDirectory),
            outputIsDirectory.boolValue
        {
            throw AudioFailure(
                "INVALID_OUTPUT", "Excerpt output \(request.output.path) is an existing directory.")
        }

        // The excerpt never resamples below an input or drops a channel, so the widest planned
        // track decides the output format, and every track must have an honest map onto it.
        let sampleRate = tracks.map(\.sampleRate).max()!
        let channels = tracks.map(\.channels).max()!
        let channelMaps = try tracks.map {
            try channelMap(from: $0.channels, to: channels, of: $0.plan.role)
        }
        let layout = ExcerptLayout(spans: request.spans, sampleRate: sampleRate)
        // Contract: a lone track plays at unity; two summed full-scale tracks are halved.
        let gain: Float = tracks.count == 1 ? 1 : 0.5

        var samples = [Float](repeating: 0, count: Int(layout.totalFrames) * channels)
        var reports: [AudioTrackReport] = []
        for (track, channelMap) in zip(tracks, channelMaps) {
            var unavailable: [SourceSpan] = []
            for (index, span) in request.spans.enumerated() {
                let readable = track.available.compactMap { SpanMath.intersection(span, $0) }
                for interval in readable {
                    // Bounded by this interval's own output end rather than the span's: a decoder
                    // that hands back priming or padding past the interval must not write over the
                    // silence an unavailable region owes the caller.
                    try track.mix(
                        recording: interval, gain: gain, channelMap: channelMap, sampleRate: sampleRate,
                        into: &samples, at: layout.frame(ofUs: interval.startUs, inSpan: index),
                        limit: layout.frame(ofUs: interval.endUs, inSpan: index))
                }
                unavailable.append(contentsOf: SpanMath.subtract(span, covering: readable))
            }
            reports.append(
                AudioTrackReport(
                    role: track.plan.role, gain: Double(gain), sampleRate: track.sampleRate,
                    channels: track.channels, unavailable: unavailable))
        }

        applyJoinRamps(layout, channels: channels, to: &samples)
        let bytes = try writeWave(
            samples, sampleRate: sampleRate, channels: channels, to: request.output)
        return AudioExcerpt(
            file: request.output.path, mediaType: "audio/wav", sampleRate: sampleRate,
            channels: channels, frames: layout.totalFrames, durationUs: layout.durationUs,
            bytes: bytes, spans: request.spans, tracks: reports)
    }

    /// Output channel to source channel, for one track. Capture records mono or stereo, and those
    /// are the only layouts this owner will state: a matching layout passes straight through, and a
    /// mono capture is heard on both sides of a stereo output. Anything wider would need a spatial
    /// placement nobody recorded — repeating a channel until the output is full invents one — so it
    /// is refused under its own code rather than answered with a layout the excerpt cannot mean.
    private static func channelMap(from source: Int, to excerpt: Int, of role: AudioRole) throws -> [Int] {
        if excerpt <= 2 {
            if source == excerpt { return Array(0..<excerpt) }
            if source == 1, excerpt == 2 { return [0, 0] }
        }
        throw AudioFailure(
            "UNSUPPORTED_FORMAT",
            "Track \(role.rawValue) has \(source) channels against a \(excerpt) channel excerpt; excerpts are mono or stereo, and map only a matching layout or a mono capture into stereo.")
    }

    /// Linear ramps inside the retained spans on both sides of every join, so a cut does not step
    /// the waveform. The first span never fades in and the last never fades out: those boundaries
    /// are the excerpt's own edges, not cuts.
    private static func applyJoinRamps(_ layout: ExcerptLayout, channels: Int, to samples: inout [Float]) {
        func scale(frame: Int64, by factor: Float) {
            let base = Int(frame) * channels
            for channel in 0..<channels { samples[base + channel] *= factor }
        }
        for index in layout.spans.indices {
            let ramp = layout.rampFrames(ofSpan: index)
            guard ramp > 0 else { continue }
            for step in 0..<ramp {
                let gain = Float(step) / Float(ramp)
                if index > 0 { scale(frame: layout.starts[index] + step, by: gain) }
                if index < layout.spans.count - 1 {
                    scale(frame: layout.starts[index + 1] - 1 - step, by: gain)
                }
            }
        }
    }

    private static func writeWave(
        _ samples: [Float], sampleRate: Int, channels: Int, to output: URL
    ) throws -> Int {
        guard
            let format = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: Double(sampleRate),
                channels: AVAudioChannelCount(channels), interleaved: true)
        else {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot describe \(sampleRate) Hz \(channels) channel output.")
        }
        // Published only once complete, so a failed write cannot leave a truncated file at the
        // path the core will hand to a reader as a finished excerpt.
        let staging = output.deletingLastPathComponent()
            .appendingPathComponent(".\(UUID().uuidString).\(output.pathExtension)")
        do {
            let file = try AVAudioFile(
                forWriting: staging, settings: format.settings, commonFormat: .pcmFormatFloat32,
                interleaved: true)
            let chunkFrames = 65_536
            var written = 0
            let totalFrames = samples.count / channels
            while written < totalFrames {
                let count = min(chunkFrames, totalFrames - written)
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))
                else { throw AudioFailure("NATIVE_DECODE_FAILED", "Cannot allocate excerpt output buffer.") }
                buffer.frameLength = AVAudioFrameCount(count)
                let destination = buffer.floatChannelData![0]
                samples.withUnsafeBufferPointer {
                    destination.update(from: $0.baseAddress! + written * channels, count: count * channels)
                }
                try file.write(from: buffer)
                written += count
            }
            // Only ever a stale excerpt: a directory at this path was refused before any decoding.
            try? FileManager.default.removeItem(at: output)
            try FileManager.default.moveItem(at: staging, to: output)
        } catch let failure as AudioFailure {
            try? FileManager.default.removeItem(at: staging)
            throw failure
        } catch {
            try? FileManager.default.removeItem(at: staging)
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot write \(output.path): \(error.localizedDescription)")
        }
        guard let size = try? FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int
        else {
            throw AudioFailure("NATIVE_DECODE_FAILED", "Excerpt output \(output.path) is unreadable.")
        }
        return size
    }
}

/// One planned source file, opened once. `available` states, in recording source time, where this
/// excerpt may read: where the caller's acquisition evidence and the file's own occupied edit-list
/// segments, shifted by the plan's offset, agree.
private struct SourceTrack {
    let plan: AudioTrackPlan
    let url: URL
    let asset: AVURLAsset
    let track: AVAssetTrack
    let sampleRate: Int
    let channels: Int
    let available: [SourceSpan]

    static func open(plan: AudioTrackPlan) async throws -> SourceTrack {
        let source = URL(fileURLWithPath: plan.source)
        guard FileManager.default.fileExists(atPath: source.path) else {
            throw AudioFailure("NATIVE_DECODE_FAILED", "No source media at \(source.path).")
        }
        let asset = AVURLAsset(url: source, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let audio: AVAssetTrack
        let stream: AudioStreamBasicDescription
        let segments: [SourceSegment]
        do {
            guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
                throw AudioFailure("NATIVE_DECODE_FAILED", "Source has no audio track: \(source.path).")
            }
            guard let description = try await track.load(.formatDescriptions).first,
                let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee
            else {
                throw AudioFailure(
                    "NATIVE_DECODE_FAILED", "Source audio format is unreadable: \(source.path).")
            }
            audio = track
            stream = basic
            segments = SourceSegment.occupied(of: try await track.load(.segments))
        } catch let failure as AudioFailure {
            throw failure
        } catch {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot open \(source.path): \(error.localizedDescription)")
        }
        let sampleRate = Int(stream.mSampleRate.rounded())
        let channels = Int(stream.mChannelsPerFrame)
        guard (1...AudioLimits.maximumSampleRate).contains(sampleRate),
            (1...AudioLimits.maximumChannels).contains(channels)
        else {
            throw AudioFailure(
                "LIMIT_EXCEEDED",
                "Source \(source.lastPathComponent) reports \(sampleRate) Hz and \(channels) channels, outside the excerpt bounds.")
        }
        // Empty edits hold no sample. AVFoundation would read them back as silence, which is
        // indistinguishable from recorded quiet, so absence is decided from the container's own
        // occupied segments rather than from the samples it is willing to produce.
        let occupied = segments.map {
            SourceSpan(
                startUs: microseconds($0.asset.start) + plan.sourceOffsetUs,
                endUs: microseconds(CMTimeRangeGetEnd($0.asset)) + plan.sourceOffsetUs)
        }
        return SourceTrack(
            plan: plan, url: source.resolvingSymlinksInPath().standardizedFileURL, asset: asset,
            track: audio, sampleRate: sampleRate, channels: channels,
            // A container cannot testify that acquisition happened: it will decode padding for a
            // hole the caller knows nothing was captured over. Only where the caller's evidence and
            // the file agree is material read; everywhere else is reported unavailable and silent.
            available: SpanMath.intersection(plan.available, occupied))
    }

    /// Sums one available recording interval into the output buffer. The reader is given that
    /// interval in asset time, so material outside the retained spans is never decoded, and the
    /// decoded frames are converted to the excerpt's own rate by AVAudioConverter.
    ///
    /// The conversion is driven to end of stream. A sample rate converter still owes output when its
    /// last input frame arrives, and a reader that resampled on its own simply stops there: the
    /// frames its filter had not yet delivered stay unwritten, and unwritten frames are
    /// indistinguishable from the silence an unavailable region owes the caller. Signalling end of
    /// stream makes the converter flush what it holds, and an interval that still ends short of the
    /// frames it owes fails rather than publishing that silence as captured audio.
    func mix(
        recording interval: SourceSpan, gain: Float, channelMap: [Int], sampleRate outputRate: Int,
        into samples: inout [Float], at destination: Int64, limit: Int64
    ) throws {
        let owed = limit - destination
        // A span shorter than a frame costs its playback time but owns no frame to read into.
        guard owed > 0 else { return }
        guard
            let sourceFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: Double(sampleRate),
                channels: AVAudioChannelCount(channels), interleaved: true),
            let excerptFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: Double(outputRate),
                channels: AVAudioChannelCount(channels), interleaved: true),
            // Both sides carry this file's own channel count, so the converter changes rate only and
            // the explicit map below places the channels; a remix matrix would restate the gains.
            let converter = AVAudioConverter(from: sourceFormat, to: excerptFormat)
        else {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED",
                "Cannot convert \(sampleRate) Hz \(channels) channel \(url.lastPathComponent) to \(outputRate) Hz.")
        }
        let reader: AVAssetReader
        do { reader = try AVAssetReader(asset: asset) } catch {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot read \(url.path): \(error.localizedDescription)")
        }
        // Read as long as the output frames this interval owns, rather than as the interval's own
        // microseconds: a converter answers N input frames with floor(N x rate ratio) frames, so a
        // fractional interval whose last output frame the layout quantised up would otherwise be
        // asked for a frame the input it was given cannot reach. That end sits at most one output
        // frame past the requested boundary, which is the frame the layout already quantised to.
        let start = time(microseconds: interval.startUs - plan.sourceOffsetUs)
        reader.timeRange = CMTimeRange(
            start: start,
            end: CMTimeAdd(start, CMTime(value: owed, timescale: CMTimeScale(outputRate))))
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                // Decoded at this file's own rate and channel count. Resampling inside the reader
                // cannot be flushed, and the platform's remix matrix would silently change the
                // contract's gains.
                AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: channels, AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true, AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ])
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw AudioFailure("NATIVE_DECODE_FAILED", "Cannot decode audio track of \(url.path).")
        }
        reader.add(output)
        reader.startReading()
        defer { reader.cancelReading() }

        let input = ConversionInput(reading: output, as: sourceFormat)
        // One buffer, drained into the excerpt and refilled, so a 30 second interval costs the same
        // conversion memory as a 10 millisecond one.
        guard let converted = AVAudioPCMBuffer(pcmFormat: excerptFormat, frameCapacity: 8_192) else {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot allocate a conversion buffer for \(url.lastPathComponent).")
        }

        var frame = destination
        var outcome = AVAudioConverterOutputStatus.haveData
        while frame < limit, outcome != .endOfStream {
            var failure: NSError?
            outcome = converter.convert(to: converted, error: &failure) { _, status in
                input.next(status)
            }
            if input.undecodable {
                throw AudioFailure(
                    "NATIVE_DECODE_FAILED",
                    "Decoder produced no samples for [\(interval.startUs),\(interval.endUs)) of \(url.lastPathComponent).")
            }
            if outcome == .error {
                throw AudioFailure(
                    "NATIVE_DECODE_FAILED",
                    "Converting \(url.lastPathComponent) to \(outputRate) Hz failed: \(failure?.localizedDescription ?? "unknown error")")
            }
            let decoded = converted.floatChannelData![0]
            for index in 0..<Int(converted.frameLength) {
                if frame >= limit { break }
                let base = Int(frame) * channelMap.count
                for (channel, sourceChannel) in channelMap.enumerated() {
                    samples[base + channel] += gain * decoded[index * channels + sourceChannel]
                }
                frame += 1
            }
        }
        if reader.status == .failed {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED",
                "Reading \(url.lastPathComponent) failed: \(reader.error?.localizedDescription ?? "unknown error")")
        }
        guard frame == limit else {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED",
                "[\(interval.startUs),\(interval.endUs)) of \(url.lastPathComponent) delivered \(frame - destination) of the \(owed) frames it owes the excerpt.")
        }
    }
}

/// One reader's decoded frames, handed to a converter one buffer at a time. AVAudioConverter calls
/// its input block synchronously from inside `convert`, so this state is only ever reached from the
/// thread doing the conversion; it lives in an object because that block is declared sendable.
private final class ConversionInput: @unchecked Sendable {
    private let output: AVAssetReaderTrackOutput
    private let format: AVAudioFormat
    /// The converter reads the supplied buffer during the call it was returned in, so each one is
    /// held until the next replaces it.
    private var supplied: AVAudioPCMBuffer?
    private(set) var undecodable = false

    init(reading output: AVAssetReaderTrackOutput, as format: AVAudioFormat) {
        self.output = output
        self.format = format
    }

    func next(_ status: UnsafeMutablePointer<AVAudioConverterInputStatus>) -> AVAudioPCMBuffer? {
        // End of this interval's material, not a dry input: the converter is told the stream ended
        // so that it flushes the output its filter still owes instead of waiting for more frames.
        guard let sample = output.copyNextSampleBuffer() else {
            status.pointee = .endOfStream
            return nil
        }
        guard let buffer = copy(of: sample) else {
            undecodable = true
            status.pointee = .endOfStream
            return nil
        }
        supplied = buffer
        status.pointee = .haveData
        return buffer
    }

    /// Copies one decoded sample buffer into a PCM buffer the converter can read. The reader hands
    /// back samples it does not copy, so they are taken while its block buffer is still retained.
    private func copy(of sample: CMSampleBuffer) -> AVAudioPCMBuffer? {
        var list = AudioBufferList()
        var block: CMBlockBuffer?
        let frames = CMSampleBufferGetNumSamples(sample)
        guard frames > 0,
            CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sample, bufferListSizeNeededOut: nil, bufferListOut: &list,
                bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
                blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block) == noErr,
            let decoded = list.mBuffers.mData?.assumingMemoryBound(to: Float.self),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))
        else { return nil }
        buffer.frameLength = AVAudioFrameCount(frames)
        buffer.floatChannelData![0].update(from: decoded, count: frames * Int(format.channelCount))
        return buffer
    }
}
