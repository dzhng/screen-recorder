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
        // track decides the output format and each narrower track is mapped onto it.
        let sampleRate = tracks.map(\.sampleRate).max()!
        let channels = tracks.map(\.channels).max()!
        let layout = ExcerptLayout(spans: request.spans, sampleRate: sampleRate)
        // Contract: a lone track plays at unity; two summed full-scale tracks are halved.
        let gain: Float = tracks.count == 1 ? 1 : 0.5

        var samples = [Float](repeating: 0, count: Int(layout.totalFrames) * channels)
        var reports: [AudioTrackReport] = []
        for track in tracks {
            var unavailable: [SourceSpan] = []
            for (index, span) in request.spans.enumerated() {
                let readable = track.available.compactMap { SpanMath.intersection(span, $0) }
                for interval in readable {
                    try track.mix(
                        recording: interval, gain: gain, channels: channels, sampleRate: sampleRate,
                        into: &samples, at: layout.frame(ofUs: interval.startUs, inSpan: index),
                        limit: layout.starts[index + 1])
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
/// file actually holds media: its occupied edit-list segments shifted by the plan's offset.
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
        return SourceTrack(
            plan: plan, url: source.resolvingSymlinksInPath().standardizedFileURL, asset: asset,
            track: audio, sampleRate: sampleRate, channels: channels,
            // Empty edits hold no sample. AVFoundation would read them back as silence, which is
            // indistinguishable from recorded quiet, so absence is decided here and reported instead.
            available: segments.map {
                SourceSpan(
                    startUs: microseconds($0.asset.start) + plan.sourceOffsetUs,
                    endUs: microseconds(CMTimeRangeGetEnd($0.asset)) + plan.sourceOffsetUs)
            })
    }

    /// Sums one available recording interval into the output buffer. The reader is given exactly
    /// that interval in asset time, so material outside the retained spans is never decoded.
    func mix(
        recording interval: SourceSpan, gain: Float, channels outputChannels: Int, sampleRate outputRate: Int,
        into samples: inout [Float], at destination: Int64, limit: Int64
    ) throws {
        let reader: AVAssetReader
        do { reader = try AVAssetReader(asset: asset) } catch {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot read \(url.path): \(error.localizedDescription)")
        }
        reader.timeRange = CMTimeRange(
            start: time(microseconds: interval.startUs - plan.sourceOffsetUs),
            end: time(microseconds: interval.endUs - plan.sourceOffsetUs))
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                // Decoded at this file's own channel count and mapped below; the platform's own
                // remix matrix would silently change the contract's gains.
                AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: outputRate,
                AVNumberOfChannelsKey: self.channels, AVLinearPCMBitDepthKey: 32,
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
        var frame = destination
        while frame < limit, let sample = output.copyNextSampleBuffer() {
            var list = AudioBufferList()
            var block: CMBlockBuffer?
            guard
                CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                    sample, bufferListSizeNeededOut: nil, bufferListOut: &list,
                    bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
                    blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block) == noErr,
                let decoded = list.mBuffers.mData?.assumingMemoryBound(to: Float.self)
            else {
                throw AudioFailure(
                    "NATIVE_DECODE_FAILED",
                    "Decoder produced no samples for [\(interval.startUs),\(interval.endUs)) of \(url.lastPathComponent).")
            }
            for index in 0..<CMSampleBufferGetNumSamples(sample) {
                if frame >= limit { break }
                let base = Int(frame) * outputChannels
                for channel in 0..<outputChannels {
                    // A narrower track feeds every wider output channel, so mono narration is heard
                    // on both sides rather than only on the left.
                    samples[base + channel] += gain * decoded[index * channels + min(channel, channels - 1)]
                }
                frame += 1
            }
        }
        if reader.status == .failed {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED",
                "Reading \(url.lastPathComponent) failed: \(reader.error?.localizedDescription ?? "unknown error")")
        }
    }
}
