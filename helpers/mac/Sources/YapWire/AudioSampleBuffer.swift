@preconcurrency import AVFoundation
import YapAudio
import YapMedia

/// One timestamped Float32 lowering for the standalone audio writer and movie mux.
enum AudioSampleBuffer {
    static func description(rate: Int, channels: Int) throws -> CMAudioFormatDescription {
        let bytes = UInt32(channels * MemoryLayout<Float>.size)
        var asbd = AudioStreamBasicDescription(
            mSampleRate: Double(rate), mFormatID: kAudioFormatLinearPCM,
            mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
            mBytesPerPacket: bytes, mFramesPerPacket: 1, mBytesPerFrame: bytes,
            mChannelsPerFrame: UInt32(channels), mBitsPerChannel: 32, mReserved: 0)
        var format: CMAudioFormatDescription?
        guard
            CMAudioFormatDescriptionCreate(
                allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil,
                magicCookieSize: 0, magicCookie: nil, extensions: nil,
                formatDescriptionOut: &format) == noErr, let format
        else { throw NativeFailure.decodeFailed("Cannot describe PCM for AAC.") }
        return format
    }

    static func sample(
        _ block: AudioPCMBlock, format: CMAudioFormatDescription, rate: Int, channels: Int
    ) throws -> CMSampleBuffer {
        let bytes = block.samples.count * MemoryLayout<Float>.size
        var data: CMBlockBuffer?
        guard
            CMBlockBufferCreateWithMemoryBlock(
                allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: bytes,
                blockAllocator: kCFAllocatorDefault, customBlockSource: nil,
                offsetToData: 0, dataLength: bytes, flags: 0, blockBufferOut: &data) == noErr,
            let data
        else { throw NativeFailure.decodeFailed("Cannot allocate AAC input block.") }
        let copied = block.samples.withUnsafeBytes {
            CMBlockBufferReplaceDataBytes(
                with: $0.baseAddress!, blockBuffer: data,
                offsetIntoDestination: 0, dataLength: bytes)
        }
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: Int32(rate)),
            presentationTimeStamp: CMTime(value: block.startFrame, timescale: Int32(rate)),
            decodeTimeStamp: .invalid)
        var size = channels * MemoryLayout<Float>.size
        var sample: CMSampleBuffer?
        guard copied == noErr,
            CMSampleBufferCreateReady(
                allocator: kCFAllocatorDefault, dataBuffer: data, formatDescription: format,
                sampleCount: block.frameCount, sampleTimingEntryCount: 1,
                sampleTimingArray: &timing,
                sampleSizeEntryCount: 1, sampleSizeArray: &size, sampleBufferOut: &sample) == noErr,
            let sample
        else { throw NativeFailure.decodeFailed("Cannot create timestamped AAC input.") }
        return sample
    }

}
