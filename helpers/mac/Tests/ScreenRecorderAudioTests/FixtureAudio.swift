@preconcurrency import AVFoundation
import Foundation

/// A generated source track whose every sample is a pure function of its own frame index, so a test
/// can state the expected excerpt independently of the code that produced it.
///
/// Each channel carries a different frequency, so a channel swap or a collapsed mix is visible. A
/// tone alone repeats, so any two source positions a whole number of periods apart would be
/// indistinguishable; a monotonic amplitude envelope stamps every sample with where in the file it
/// came from. One marked region holds full-scale samples no retained span ever includes, and one
/// holds true recorded silence, so absence of media and recorded quiet cannot be confused.
struct FixtureTone {
    let frequencies: [Double]
    let sampleRate: Double
    /// Frames over which the position envelope rises; the fixture's own length.
    let stampFrames: Int
    /// Full-scale material that must never reach an excerpt whose spans exclude it.
    let markedUs: SourceInterval?
    /// Recorded quiet: the microphone was open and captured nothing.
    let silentUs: SourceInterval?

    struct SourceInterval {
        let startUs: Int64
        let endUs: Int64
        func contains(frame: Int, at rate: Double) -> Bool {
            let us = Int64((Double(frame) / rate * 1_000_000).rounded())
            return us >= startUs && us < endUs
        }
    }

    var channels: Int { frequencies.count }

    func sample(frame: Int, channel: Int) -> Float {
        if let silentUs, silentUs.contains(frame: frame, at: sampleRate) { return 0 }
        if let markedUs, markedUs.contains(frame: frame, at: sampleRate) {
            return frame % 2 == 0 ? 1 : -1
        }
        let envelope = 0.4 + 0.6 * Double(frame) / Double(stampFrames)
        return Float(0.5 * envelope * sin(2 * Double.pi * frequencies[channel] * Double(frame) / sampleRate))
    }

    /// The frame index of a source time in this track's own timeline.
    func frame(ofUs us: Int64) -> Int { Int((Double(us) / 1_000_000 * sampleRate).rounded()) }
}

enum FixtureAudioWriter {
    /// Writes uncompressed float PCM in MOV, the container capture uses for narration and system
    /// audio, so the excerpt reads the same format in tests as in production.
    static func write(_ tone: FixtureTone, frames: Int, to url: URL) async throws {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        guard let format = format(of: tone) else { throw FixtureError.unwritable }
        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: format.settings)
        input.expectsMediaDataInRealTime = false
        guard writer.canAdd(input) else { throw FixtureError.unwritable }
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? FixtureError.unwritable }
        writer.startSession(atSourceTime: .zero)

        var description: CMAudioFormatDescription?
        var stream = format.streamDescription.pointee
        CMAudioFormatDescriptionCreate(
            allocator: nil, asbd: &stream, layoutSize: 0, layout: nil, magicCookieSize: 0,
            magicCookie: nil, extensions: nil, formatDescriptionOut: &description)
        let chunk = 4_800
        var produced = 0
        while produced < frames {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 200_000) }
            let count = min(chunk, frames - produced)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))
            else { throw FixtureError.unwritable }
            buffer.frameLength = AVAudioFrameCount(count)
            let destination = buffer.floatChannelData![0]
            for index in 0..<count {
                for channel in 0..<tone.channels {
                    destination[index * tone.channels + channel] = tone.sample(
                        frame: produced + index, channel: channel)
                }
            }
            var sample: CMSampleBuffer?
            CMSampleBufferCreate(
                allocator: nil, dataBuffer: nil, dataReady: false, makeDataReadyCallback: nil,
                refcon: nil, formatDescription: description, sampleCount: CMItemCount(count),
                sampleTimingEntryCount: 1,
                sampleTimingArray: [
                    CMSampleTimingInfo(
                        duration: CMTime(value: 1, timescale: Int32(tone.sampleRate)),
                        presentationTimeStamp: CMTime(value: Int64(produced), timescale: Int32(tone.sampleRate)),
                        decodeTimeStamp: .invalid)
                ], sampleSizeEntryCount: 1, sampleSizeArray: [4 * tone.channels],
                sampleBufferOut: &sample)
            guard let sample,
                CMSampleBufferSetDataBufferFromAudioBufferList(
                    sample, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0,
                    bufferList: buffer.audioBufferList) == noErr, input.append(sample)
            else { throw writer.error ?? FixtureError.unwritable }
            produced += count
        }
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? FixtureError.unwritable }
    }

    /// Above stereo a format has no implied layout, so a wider fixture declares each channel as its
    /// own discrete one. That is the shape of a file an excerpt must refuse rather than remix.
    private static func format(of tone: FixtureTone) -> AVAudioFormat? {
        if tone.channels <= 2 {
            return AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: tone.sampleRate,
                channels: AVAudioChannelCount(tone.channels), interleaved: true)
        }
        var description = AudioChannelLayout()
        description.mChannelLayoutTag = kAudioChannelLayoutTag_DiscreteInOrder | UInt32(tone.channels)
        let layout = AVAudioChannelLayout(layout: &description)
        return AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: tone.sampleRate, interleaved: true,
            channelLayout: layout)
    }

    /// Writes a copy of `source` whose track holds media only inside `occupied`, leaving empty
    /// edits elsewhere. This is the shape a recovered or repositioned capture track has.
    static func writeGapped(
        from source: URL, occupied: [(source: CMTimeRange, at: CMTime)], to url: URL, duration: CMTime
    ) async throws {
        let composition = AVMutableComposition()
        guard let target = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { throw FixtureError.unwritable }
        let asset = AVURLAsset(url: source, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let audio = try await asset.loadTracks(withMediaType: .audio).first else {
            throw FixtureError.unwritable
        }
        for piece in occupied { try target.insertTimeRange(piece.source, of: audio, at: piece.at) }
        if composition.duration < duration {
            target.insertEmptyTimeRange(CMTimeRange(start: composition.duration, end: duration))
        }
        try? FileManager.default.removeItem(at: url)
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)
        else { throw FixtureError.unwritable }
        try await export.export(to: url, as: .mov)
    }

    enum FixtureError: Error { case unwritable }
}

/// Reads back what an excerpt file actually holds by parsing its chunks directly, so the oracle
/// never inherits a framing assumption from the writer that produced the file.
struct FixtureWave {
    let container: String
    let format: String
    /// WAVE format tag: 3 is IEEE float.
    let formatTag: Int
    let bitsPerSample: Int
    let sampleRate: Double
    let channels: Int
    let frames: Int
    /// Interleaved float samples.
    let samples: [Float]

    init(contentsOf url: URL) throws {
        let data = try Data(contentsOf: url)
        guard data.count >= 12 else { throw FixtureAudioWriter.FixtureError.unwritable }
        container = String(decoding: data[0..<4], as: UTF8.self)
        format = String(decoding: data[8..<12], as: UTF8.self)
        var tag = 0
        var depth = 0
        var rate = 0.0
        var channelCount = 0
        var values: [Float] = []
        var offset = 12
        while offset + 8 <= data.count {
            let identifier = String(decoding: data[offset..<(offset + 4)], as: UTF8.self)
            let size = Int(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: offset + 4, as: UInt32.self) })
            let body = offset + 8
            if identifier == "fmt " {
                tag = Int(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: body, as: UInt16.self) })
                channelCount = Int(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: body + 2, as: UInt16.self) })
                rate = Double(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: body + 4, as: UInt32.self) })
                depth = Int(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: body + 14, as: UInt16.self) })
            } else if identifier == "data" {
                values = (0..<(size / 4)).map { index in
                    data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: body + index * 4, as: Float.self) }
                }
            }
            offset = body + size + size % 2
        }
        formatTag = tag
        bitsPerSample = depth
        sampleRate = rate
        channels = channelCount
        samples = values
        frames = channelCount > 0 ? values.count / channelCount : 0
    }

    func sample(frame: Int, channel: Int) -> Float { samples[frame * channels + channel] }

    /// Magnitude of one frequency over a frame window, normalised so a sine of that frequency reads
    /// about its own amplitude. Goertzel, so a test can state "this channel carries 1000 Hz and not
    /// 1500 Hz" without a full transform.
    func magnitude(ofHz frequency: Double, channel: Int, from start: Int, count: Int) -> Double {
        let omega = 2 * Double.pi * frequency / sampleRate
        let coefficient = 2 * cos(omega)
        var previous = 0.0
        var beforePrevious = 0.0
        for index in start..<(start + count) {
            let current = Double(sample(frame: index, channel: channel)) + coefficient * previous - beforePrevious
            beforePrevious = previous
            previous = current
        }
        let real = previous - beforePrevious * cos(omega)
        let imaginary = beforePrevious * sin(omega)
        return 2 * (real * real + imaginary * imaginary).squareRoot() / Double(count)
    }

    func peak(from start: Int, count: Int) -> Float {
        var largest: Float = 0
        for frame in start..<(start + count) {
            for channel in 0..<channels { largest = max(largest, abs(sample(frame: frame, channel: channel))) }
        }
        return largest
    }
}
