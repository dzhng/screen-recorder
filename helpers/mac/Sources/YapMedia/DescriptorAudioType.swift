import AudioToolbox
import Darwin
import Foundation

/// Container identification only. AVFoundation and the audio reader still decide decodability.
struct DescriptorAudioType {
    let extensionName: String
    let contentType: String

    init(_ fileType: AudioFileTypeID) throws {
        var fileType = fileType
        func strings(_ property: AudioFilePropertyID) throws -> [String] {
            var values: Unmanaged<CFArray>?
            var size = UInt32(MemoryLayout<CFArray?>.size)
            let status = AudioFileGetGlobalInfo(property, UInt32(MemoryLayout<AudioFileTypeID>.size),
                &fileType, &size, &values)
            guard status == noErr, let values else {
                throw NativeFailure.decodeFailed("Audio container type information is unavailable.")
            }
            return values.takeRetainedValue() as? [String] ?? []
        }
        guard let suffix = try strings(kAudioFileGlobalInfo_ExtensionsForType).first,
            let uti = try strings(kAudioFileGlobalInfo_UTIsForType).first else {
            throw NativeFailure.decodeFailed("Audio container has no registered media type.")
        }
        extensionName = suffix
        contentType = uti
    }

    static func identify(_ descriptor: MediaDescriptor, maximumBytes: Int64) throws
        -> (type: DescriptorAudioType, readBytes: Int64)
    {
        let input = try IdentificationInput(descriptor, maximumBytes: maximumBytes)
        return try withExtendedLifetime(input) {
            var file: AudioFileID?
            let status = AudioFileOpenWithCallbacks(Unmanaged.passUnretained(input).toOpaque(),
                { opaque, position, count, buffer, actual in
                    let input = Unmanaged<IdentificationInput>.fromOpaque(opaque).takeUnretainedValue()
                    actual.pointee = 0
                    guard input.failure == nil else { return kAudioFileUnspecifiedError }
                    do {
                        actual.pointee = try input.read(position: position, count: count, buffer: buffer)
                        return noErr
                    } catch {
                        input.failure = error
                        return kAudioFileUnspecifiedError
                    }
                }, nil,
                { Unmanaged<IdentificationInput>.fromOpaque($0).takeUnretainedValue().length },
                nil, 0, &file)
            defer { if let file { AudioFileClose(file) } }
            if let failure = input.failure { throw failure }
            guard status == noErr, let file else {
                throw NativeFailure.decodeFailed("Cannot identify the inherited audio container.")
            }
            var type: AudioFileTypeID = 0
            var size = UInt32(MemoryLayout<AudioFileTypeID>.size)
            guard AudioFileGetProperty(file, kAudioFilePropertyFileFormat, &size, &type) == noErr else {
                throw NativeFailure.decodeFailed("Cannot read the inherited audio container type.")
            }
            return (try DescriptorAudioType(type), input.readBytes)
        }
    }
}

private final class IdentificationInput {
    let descriptor: MediaDescriptor
    let length: Int64
    let maximumBytes: Int64
    var readBytes: Int64 = 0
    var failure: Error?
    init(_ descriptor: MediaDescriptor, maximumBytes: Int64) throws {
        self.descriptor = descriptor
        length = try descriptor.size
        self.maximumBytes = maximumBytes
    }
    func read(position: Int64, count: UInt32, buffer: UnsafeMutableRawPointer) throws -> UInt32 {
        try Task.checkCancellation()
        guard position >= 0, try descriptor.size == length else {
            throw NativeFailure.decodeFailed("Invalid audio identification range or changed handle.")
        }
        if position >= length { return 0 }
        let count = Int(min(Int64(count), length - position))
        if Int64(count) > maximumBytes - readBytes {
            throw NativeFailure("LIMIT_EXCEEDED", "Media input exceeds its inspection byte budget.")
        }
        var copied = 0
        while copied < count {
            try Task.checkCancellation()
            let actual = pread(descriptor.descriptor, buffer.advanced(by: copied), count - copied,
                position + Int64(copied))
            if actual < 0 && errno == EINTR { continue }
            guard actual > 0 else { throw NativeFailure.decodeFailed("Cannot read audio identification bytes.") }
            copied += actual
            readBytes += Int64(actual)
        }
        return UInt32(copied)
    }
}
