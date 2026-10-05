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
    public struct EncoderSelection: Codable, Sendable {
        let hardware: String
        let id: String?
        let gpu: GPU?
        struct GPU: Codable, Sendable {
            let policy: String
            let registryId: String
        }
        func dictionary() throws -> [String: Any] {
            var values: [String: Any] = [:]
            switch hardware {
            case "auto": break
            case "required":
                values[kVTVideoEncoderSpecification_RequireHardwareAcceleratedVideoEncoder as String] = true
            case "disabled":
                values[kVTVideoEncoderSpecification_EnableHardwareAcceleratedVideoEncoder as String] = false
            default: throw invalid("Unknown hardware encoding policy")
            }
            if let id { values[kVTVideoEncoderSpecification_EncoderID as String] = id }
            if let gpu {
                guard hardware != "disabled", let registryId = UInt64(gpu.registryId),
                    ["preferred", "required"].contains(gpu.policy)
                else { throw invalid("Invalid encoder GPU selection") }
                let key = gpu.policy == "required"
                    ? kVTVideoEncoderSpecification_RequiredEncoderGPURegistryID
                    : kVTVideoEncoderSpecification_PreferredEncoderGPURegistryID
                values[key as String] = NSNumber(value: registryId)
            }
            return values
        }
    }
    /// A null flag is an authored encoder-default choice and must survive the response round trip.
    public struct EncoderFlag: Codable, Sendable {
        let value: Bool?
        public init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            value = container.decodeNil() ? nil : try container.decode(Bool.self)
        }
        public func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            if let value { try container.encode(value) } else { try container.encodeNil() }
        }
    }
    public struct Video: Codable, Sendable {
        public let codec: String
        let encoder: EncoderSelection
        let color: String
        let rateControl: RateControl
        let profile: String
        let level: String?
        let keyframeInterval: Int
        let keyframeIntervalSeconds: Double
        let frameReordering: Bool
        let entropy: String?
        let temporalCompression: Bool
        let openGop: EncoderFlag
        let prioritizeSpeed: EncoderFlag
        let powerEfficient: Bool
        let dataRateLimits: [DataLimit]
        let bufferDurationSeconds: Double?
        let initialBufferDelayPercent: Double?
        let lookAheadFrames: Int?
        let spatialAdaptiveQuantization: EncoderFlag
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
            guard codec == "aac", sampleRate > 0,
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
                guard let bits = rateControl.bitrate, bits > 0
                else {
                    throw invalid("Unsupported AAC bitrate")
                }
                settings[AVEncoderBitRateKey] = bits
            }
            guard let input = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2),
                let output = AVAudioFormat(settings: settings),
                let converter = AVAudioConverter(from: input, to: output)
            else {
                throw invalid("AAC cannot convert the requested output format")
            }
            converter.bitRateStrategy = strategy
            if let rates = converter.applicableEncodeSampleRates,
                !rates.contains(NSNumber(value: sampleRate))
            {
                throw invalid("AAC sample rate is not supported for this format")
            }
            if rateControl.mode != "variable", let bits = rateControl.bitrate,
                let rates = converter.applicableEncodeBitRates,
                !rates.contains(NSNumber(value: bits))
            {
                throw invalid("AAC bitrate is not supported for this rate, layout and strategy")
            }
            return settings
        }
    }
    public struct AudioFile: Codable, Sendable {
        public let container: String
        public let audio: Audio

        public func validate() throws {
            guard container == "m4a" else { throw invalid("Unsupported standalone audio container") }
            guard audio.rateControl.mode == "variable" ? audio.rateControl.bitrate == nil
                : audio.rateControl.quality == nil else {
                throw invalid("AAC rate-control parameters do not match the requested strategy")
            }
            let settings = try audio.dictionary()
            let writer = AVAssetWriter(contentType: .mpeg4Movie)
            guard writer.canApply(outputSettings: settings, forMediaType: .audio) else {
                throw invalid("AAC cannot encode the requested standalone format")
            }
        }
    }
    private func compression(frameRate: Double) throws -> [String: Any] {
        guard container == "mp4", video.color == "rec709" else {
            throw Self.invalid("Unsupported video encoding settings")
        }
        let profileLevel: String
        if video.codec == "hevc" {
            guard video.profile == "main", video.level == nil, video.entropy == nil else {
                throw Self.invalid("HEVC requires Main SDR without H264 level or entropy controls")
            }
            profileLevel = kVTProfileLevel_HEVC_Main_AutoLevel as String
        } else {
            guard video.codec == "h264",
                ["baseline", "constrained-baseline", "main", "high", "constrained-high"].contains(video.profile),
                let level = video.level,
                ["auto", "1.3", "3.0", "3.1", "3.2", "4.0", "4.1", "4.2", "5.0", "5.1", "5.2"].contains(level),
                ["cavlc", "cabac"].contains(video.entropy ?? "")
            else { throw Self.invalid("Unsupported H264 encoding settings") }
            let profile = video.profile.split(separator: "-")
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
            profileLevel = "H264_\(profile)_\(level == "auto" ? "AutoLevel" : level.replacingOccurrences(of: ".", with: "_"))"
        }
        var values: [String: Any] = [
            kVTCompressionPropertyKey_ProfileLevel as String: profileLevel,
            kVTCompressionPropertyKey_ExpectedFrameRate as String: frameRate,
            kVTCompressionPropertyKey_RealTime as String: false,
            kVTCompressionPropertyKey_MaxKeyFrameInterval as String: video.keyframeInterval,
            kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration as String: video.keyframeIntervalSeconds,
            kVTCompressionPropertyKey_AllowFrameReordering as String: video.frameReordering,
            kVTCompressionPropertyKey_AllowTemporalCompression as String: video.temporalCompression,
            kVTCompressionPropertyKey_MaximizePowerEfficiency as String: video.powerEfficient,
        ]
        if let entropy = video.entropy {
            values[kVTCompressionPropertyKey_H264EntropyMode as String] = entropy == "cabac"
                ? kVTH264EntropyMode_CABAC : kVTH264EntropyMode_CAVLC
        }
        // AVAssetWriter rejects explicit zero for these VT automatic values; omission has the same meaning.
        if video.keyframeInterval == 0 {
            values.removeValue(forKey: kVTCompressionPropertyKey_MaxKeyFrameInterval as String)
        }
        switch video.rateControl.mode {
        case "average", "constant":
            guard let bits = video.rateControl.bitrate,
                bits >= (video.rateControl.mode == "average" ? 0 : 1)
            else {
                throw Self.invalid("Unsupported video bitrate")
            }
            if bits != 0 {
                values[
                    (video.rateControl.mode == "average"
                        ? kVTCompressionPropertyKey_AverageBitRate
                        : kVTCompressionPropertyKey_ConstantBitRate)
                        as String] = bits
            }
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
        if let openGop = video.openGop.value {
            values[kVTCompressionPropertyKey_AllowOpenGOP as String] = openGop
        }
        if let prioritizeSpeed = video.prioritizeSpeed.value {
            values[kVTCompressionPropertyKey_PrioritizeEncodingSpeedOverQuality as String] = prioritizeSpeed
        }
        if let spatial = video.spatialAdaptiveQuantization.value {
            values[kVTCompressionPropertyKey_SpatialAdaptiveQPLevel as String] = spatial ? -1 : 0
        }
        if let frames = video.lookAheadFrames {
            values[kVTCompressionPropertyKey_SuggestedLookAheadFrameCount as String] = frames
        }
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
        let specification = try video.encoder.dictionary()
        var session: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil, width: Int32(width), height: Int32(height),
            codecType: video.codec == "hevc" ? kCMVideoCodecType_HEVC : kCMVideoCodecType_H264,
            encoderSpecification: specification as CFDictionary, imageBufferAttributes: nil, compressedDataAllocator: nil,
            outputCallback: nil, refcon: nil, compressionSessionOut: &session)
        guard status == noErr, let session else {
            throw Self.invalid("\(video.codec) encoder unavailable (\(status))")
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
            AVVideoCodecKey: video.codec == "hevc" ? AVVideoCodecType.hevc : AVVideoCodecType.h264, AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: compression,
            AVVideoEncoderSpecificationKey: specification,
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
            if video.codec == "hevc" {
                guard CMFormatDescriptionGetMediaSubType(format) == kCMVideoCodecType_HEVC,
                    let atoms = CMFormatDescriptionGetExtension(format,
                        extensionKey: kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms) as? [String: Any],
                    let header = atoms["hvcC"] as? Data, header.count >= 23,
                    header[0] == 1, header[1] & 31 == 1,
                    header[17] & 7 == 0, header[18] & 7 == 0
                else { throw Self.invalid("Encoded HEVC Main 8-bit profile cannot be verified") }
                let level = "\(header[12] / 30).\((header[12] % 30) / 3)"
                actual = EncodedVideo(profile: "main", level: level)
                continue
            }
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
            let constrained = (profile == "baseline" && pointer[2] & 0x40 != 0)
                || (profile == "high" && pointer[2] & 0x0c == 0x0c)
            let requestedBase = video.profile.replacingOccurrences(of: "constrained-", with: "")
            guard profile == requestedBase,
                !video.profile.starts(with: "constrained-") || constrained,
                video.level == "auto" || level == video.level else {
                throw Self.invalid("Encoder changed requested H.264 profile or level")
            }
            actual = EncodedVideo(profile: video.profile, level: level)
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
    private static func videoInventory(codec: CMVideoCodecType, name: String) throws -> [String: Any] {
        var session: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil, width: 1280, height: 720, codecType: codec,
            encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil,
            outputCallback: nil, refcon: nil, compressionSessionOut: &session)
        guard status == noErr, let session else { return ["ready": false, "probeStatus": status, "encoders": []] }
        defer { VTCompressionSessionInvalidate(session) }
        var properties: CFDictionary?
        guard
            VTSessionCopySupportedPropertyDictionary(
                session, supportedPropertyDictionaryOut: &properties)
                == noErr, let properties
        else { throw invalid("Cannot inspect encoder capabilities") }
        var encoderList: CFArray?
        guard VTCopyVideoEncoderList(nil, &encoderList) == noErr, let encoderList else {
            throw invalid("Cannot inspect encoder selection capabilities")
        }
        let encoders = (encoderList as! [[String: Any]]).filter {
            ($0[kVTVideoEncoderList_CodecType as String] as? NSNumber)?.uint32Value == codec
        }.map { entry -> [String: Any] in
            var value: [String: Any] = [
                "id": entry[kVTVideoEncoderList_EncoderID as String]!,
                "name": entry[kVTVideoEncoderList_EncoderName as String] ?? name,
            ]
            if let hardware = entry[kVTVideoEncoderList_IsHardwareAccelerated as String] {
                value["hardwareAccelerated"] = hardware
            }
            if let gpu = entry[kVTVideoEncoderList_GPURegistryID as String] as? NSNumber {
                value["gpuRegistryId"] = gpu.stringValue
            }
            var selected: VTCompressionSession?
            let status = VTCompressionSessionCreate(
                allocator: nil, width: 1280, height: 720, codecType: codec,
                encoderSpecification: [kVTVideoEncoderSpecification_EncoderID: value["id"]!] as CFDictionary,
                imageBufferAttributes: nil, compressedDataAllocator: nil,
                outputCallback: nil, refcon: nil, compressionSessionOut: &selected)
            if status == noErr, let selected {
                defer { VTCompressionSessionInvalidate(selected) }
                var supported: CFDictionary?
                if VTSessionCopySupportedPropertyDictionary(selected, supportedPropertyDictionaryOut: &supported) == noErr,
                    let supported {
                    value["properties"] = supported as! [String: Any]
                }
            }
            value["probeStatus"] = status
            return value
        }
        return ["ready": true, "probeStatus": 0, "properties": properties as! [String: Any], "encoders": encoders]
    }
    public static func inventory() throws -> [String: Any] {
        let h264 = try videoInventory(codec: kCMVideoCodecType_H264, name: "H.264")
        guard h264["ready"] as? Bool == true else { throw invalid("H.264 encoder unavailable") }
        let hevc = try videoInventory(codec: kCMVideoCodecType_HEVC, name: "HEVC")
        guard let input = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2),
            let baseline = AVAudioFormat(settings: [AVFormatIDKey: kAudioFormatMPEG4AAC,
                                                   AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2]),
            let converter = AVAudioConverter(from: input, to: baseline),
            let rates = converter.availableEncodeSampleRates
        else { throw invalid("Cannot inspect AAC capabilities") }
        var audioFormats: [[String: Any]] = []
        for rate in rates {
            for channels in [1, 2] {
                guard let format = AVAudioFormat(settings: [AVFormatIDKey: kAudioFormatMPEG4AAC,
                                                           AVSampleRateKey: rate, AVNumberOfChannelsKey: channels]),
                    let audio = AVAudioConverter(from: input, to: format)
                else { continue }
                for (mode, strategy) in ["constant": AVAudioBitRateStrategy_Constant,
                                          "long-term-average": AVAudioBitRateStrategy_LongTermAverage,
                                          "constrained-variable": AVAudioBitRateStrategy_VariableConstrained] {
                    audio.bitRateStrategy = strategy
                    if let bitrates = audio.applicableEncodeBitRates {
                        audioFormats.append(["sampleRate": rate, "layout": channels == 1 ? "mono" : "stereo",
                                             "strategy": mode, "bitrates": bitrates])
                    }
                }
            }
        }
        return ["properties": h264["properties"]!, "encoders": h264["encoders"]!, "hevc": hevc,
                "audio": ["sampleRates": rates, "formats": audioFormats]]
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("UNSUPPORTED_FORMAT", message)
    }
}
