@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia
import UniformTypeIdentifiers
import VideoToolbox

/// Encoding policy is resolved by the shared public schema; this boundary lowers it to the SDK.
public struct OutputSettings: Codable, Sendable {
    public let container: String
    public let video: Video
    public let audio: Audio
    public struct RateControl: Codable, Sendable {
        public let mode: String
        public let bitrate: Int?
        public let quality: Double?
        public let maximumBitrate: Int?
    }
    public struct DataLimit: Codable, Sendable {
        let bytes: Int
        let seconds: Double
    }
    public struct Video: Codable, Sendable {
        let codec: String
        let color: String
        let rateControl: RateControl
        let profile: String
        let level: String
        let keyframeInterval: Int
        let keyframeIntervalSeconds: Double
        let frameReordering: Bool
        let entropy: String
        let temporalCompression: Bool
        let openGop: Bool
        let prioritizeSpeed: Bool
        let powerEfficient: Bool
        let dataRateLimits: [DataLimit]
        let bufferDurationSeconds: Double?
        let initialBufferDelayPercent: Double?
        let spatialAdaptiveQuantization: Bool
        let nonDroppableFrameRate: Double?
        let minimumQuantizer: Int?
        let maximumQuantizer: Int?
    }
    public struct AudioRateControl: Codable, Sendable {
        public let mode: String
        public let bitrate: Int?
        public let quality: String?
    }
    public struct Audio: Codable, Sendable {
        public let codec: String
        public let sampleRate: Int
        public let layout: String
        public let rateControl: AudioRateControl
        public let quality: String
        public var channels: Int { layout == "mono" ? 1 : 2 }
        public func dictionary() throws -> [String: Any] {
            let qualities = ["min": 0, "low": 32, "medium": 64, "high": 96, "max": 127]
            let strategies = [
                "constant": AVAudioBitRateStrategy_Constant,
                "long-term-average": AVAudioBitRateStrategy_LongTermAverage,
                "constrained-variable": AVAudioBitRateStrategy_VariableConstrained,
                "variable": AVAudioBitRateStrategy_Variable,
            ]
            guard codec == "aac", [32000, 44100, 48000].contains(sampleRate),
                ["mono", "stereo"].contains(layout), let strategy = strategies[rateControl.mode],
                let quality = qualities[quality]
            else { throw invalid("Unsupported AAC output settings") }
            var settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: channels, AVEncoderBitRateStrategyKey: strategy,
                AVEncoderAudioQualityKey: quality,
            ]
            if rateControl.mode == "variable" {
                guard let value = rateControl.quality, let vbr = qualities[value] else {
                    throw invalid("Variable AAC requires quality")
                }
                settings[AVEncoderAudioQualityForVBRKey] = vbr
            } else {
                guard let bits = rateControl.bitrate, bits >= 32000, bits <= channels * 160000
                else {
                    throw invalid("Unsupported AAC bitrate")
                }
                settings[AVEncoderBitRateKey] = bits
            }
            return settings
        }
    }
    private func compression(frameRate: Double) throws -> [String: Any] {
        guard container == "mp4", video.codec == "h264", video.color == "rec709",
            ["baseline", "main", "high"].contains(video.profile),
            ["auto", "3.0", "3.1", "3.2", "4.0", "4.1", "4.2", "5.0", "5.1", "5.2"].contains(
                video.level)
        else { throw Self.invalid("Unsupported video encoding settings") }
        let profile = video.profile.prefix(1).uppercased() + video.profile.dropFirst()
        let level =
            video.level == "auto"
            ? "AutoLevel" : video.level.replacingOccurrences(of: ".", with: "_")
        var values: [String: Any] = [
            kVTCompressionPropertyKey_ProfileLevel as String: "H264_\(profile)_\(level)",
            kVTCompressionPropertyKey_ExpectedFrameRate as String: frameRate,
            kVTCompressionPropertyKey_MaxKeyFrameInterval as String: video.keyframeInterval,
            kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration as String: video
                .keyframeIntervalSeconds,
            kVTCompressionPropertyKey_AllowFrameReordering as String: video.frameReordering,
            kVTCompressionPropertyKey_H264EntropyMode as String: video.entropy == "cabac"
                ? kVTH264EntropyMode_CABAC : kVTH264EntropyMode_CAVLC,
            kVTCompressionPropertyKey_AllowTemporalCompression as String: video.temporalCompression,
            kVTCompressionPropertyKey_AllowOpenGOP as String: video.openGop,
            kVTCompressionPropertyKey_PrioritizeEncodingSpeedOverQuality as String: video
                .prioritizeSpeed,
            kVTCompressionPropertyKey_MaximizePowerEfficiency as String: video.powerEfficient,
        ]
        switch video.rateControl.mode {
        case "average", "constant":
            guard let bits = video.rateControl.bitrate, bits >= 16000, bits <= 200_000_000 else {
                throw Self.invalid("Unsupported video bitrate")
            }
            values[
                (video.rateControl.mode == "average"
                    ? kVTCompressionPropertyKey_AverageBitRate
                    : kVTCompressionPropertyKey_ConstantBitRate)
                    as String] = bits
        case "variable":
            guard let bits = video.rateControl.bitrate else {
                throw Self.invalid("Variable bitrate requires a target")
            }
            values[kVTCompressionPropertyKey_VariableBitRate as String] = bits
            if let maximum = video.rateControl.maximumBitrate {
                values[kVTCompressionPropertyKey_VBVMaxBitRate as String] = maximum
            }
        case "quality":
            guard let quality = video.rateControl.quality, quality >= 0, quality <= 1 else {
                throw Self.invalid("Unsupported video quality")
            }
            values[kVTCompressionPropertyKey_Quality as String] = quality
        default: throw Self.invalid("Unsupported video rate control")
        }
        values[kVTCompressionPropertyKey_SpatialAdaptiveQPLevel as String] =
            video.spatialAdaptiveQuantization ? -1 : 0
        if let duration = video.bufferDurationSeconds {
            values[kVTCompressionPropertyKey_VBVBufferDuration as String] = duration
        }
        if let delay = video.initialBufferDelayPercent {
            values[kVTCompressionPropertyKey_VBVInitialDelayPercentage as String] = delay
        }
        if !video.dataRateLimits.isEmpty {
            values[kVTCompressionPropertyKey_DataRateLimits as String] = video.dataRateLimits
                .flatMap {
                    [Double($0.bytes), $0.seconds]
                }
        }
        if let rate = video.nonDroppableFrameRate {
            guard rate > 0, rate <= frameRate else {
                throw Self.invalid("Non-droppable frame rate exceeds composition frame rate")
            }
            values[AVVideoAverageNonDroppableFrameRateKey] = rate
        }
        if let minimum = video.minimumQuantizer {
            values[kVTCompressionPropertyKey_MinAllowedFrameQP as String] = minimum
        }
        if let maximum = video.maximumQuantizer {
            values[kVTCompressionPropertyKey_MaxAllowedFrameQP as String] = maximum
        }
        return values
    }
    public func videoDictionary(width: Int, height: Int, frameRate: Double) throws -> [String: Any]
    {
        let compression = try compression(frameRate: frameRate)
        var session: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil, width: Int32(width), height: Int32(height),
            codecType: kCMVideoCodecType_H264,
            encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil,
            outputCallback: nil, refcon: nil, compressionSessionOut: &session)
        guard status == noErr, let session else {
            throw Self.invalid("H.264 encoder unavailable (\(status))")
        }
        defer { VTCompressionSessionInvalidate(session) }
        for key in compression.keys.sorted() {
            let status = VTSessionSetProperty(
                session, key: key as CFString, value: compression[key]! as CFTypeRef)
            guard status == noErr else {
                throw Self.invalid(
                    "Encoder does not support \(key) with the requested value (\(status))")
            }
        }
        let prepared = VTCompressionSessionPrepareToEncodeFrames(session)
        guard prepared == noErr else {
            throw Self.invalid("Unsupported encoder combination (\(prepared))")
        }
        return [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: compression,
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
            ],
        ]
    }
    public struct EncodedVideo: Codable, Sendable {
        public let profile: String
        public let level: String
    }
    public func inspectVideo(_ url: URL) async throws -> EncodedVideo {
        let asset = AVURLAsset(url: url)
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            throw Self.invalid("Encoded output has no video track")
        }
        let formats = try await track.load(.formatDescriptions)
        guard !formats.isEmpty else { throw Self.invalid("Encoded video has no format") }
        var actual: EncodedVideo?
        for format in formats {
            guard CMFormatDescriptionGetMediaSubType(format) == kCMVideoCodecType_H264 else {
                throw Self.invalid("Encoder changed requested video codec")
            }
            var pointer: UnsafePointer<UInt8>?
            var size = 0
            let status = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
                format, parameterSetIndex: 0, parameterSetPointerOut: &pointer,
                parameterSetSizeOut: &size, parameterSetCountOut: nil,
                nalUnitHeaderLengthOut: nil)
            guard status == noErr, let pointer, size >= 4, pointer[0] & 31 == 7,
                let profile = [0x42: "baseline", 0x4d: "main", 0x64: "high"][Int(pointer[1])]
            else { throw Self.invalid("Encoded H.264 profile cannot be verified") }
            let level = "\(pointer[3] / 10).\(pointer[3] % 10)"
            guard profile == video.profile, video.level == "auto" || level == video.level else {
                throw Self.invalid("Encoder changed requested H.264 profile or level")
            }
            actual = EncodedVideo(profile: profile, level: level)
        }
        return actual!
    }
    public func validate(width: Int, height: Int, frameRate: Double, hasAudio: Bool) throws {
        let writer = AVAssetWriter(contentType: .mpeg4Movie)
        let videoSettings = try videoDictionary(width: width, height: height, frameRate: frameRate)
        guard writer.canApply(outputSettings: videoSettings, forMediaType: .video) else {
            throw Self.invalid("Video settings cannot encode this canvas")
        }
        if hasAudio {
            let audioSettings = try audio.dictionary()
            guard writer.canApply(outputSettings: audioSettings, forMediaType: .audio) else {
                throw Self.invalid("AAC cannot encode the requested output format")
            }
        }
    }
    public static func inventory() throws -> [String: Any] {
        var session: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil, width: 1280, height: 720, codecType: kCMVideoCodecType_H264,
            encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil,
            outputCallback: nil, refcon: nil, compressionSessionOut: &session)
        guard status == noErr, let session else { throw invalid("H.264 encoder unavailable") }
        defer { VTCompressionSessionInvalidate(session) }
        var properties: CFDictionary?
        guard
            VTSessionCopySupportedPropertyDictionary(
                session, supportedPropertyDictionaryOut: &properties)
                == noErr, let properties
        else { throw invalid("Cannot inspect encoder capabilities") }
        return properties as! [String: Any]
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("UNSUPPORTED_FORMAT", message)
    }
}
