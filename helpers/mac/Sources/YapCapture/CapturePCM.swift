@preconcurrency import AVFoundation
import AudioToolbox
import Foundation

/// A track's fixed rate/channels and canonical PCM input representation. Queue-owned by CaptureWriter.
final class CapturePCM {
  let format: CMAudioFormatDescription
  private var output: AudioStreamBasicDescription
  private var converter: AudioConverterRef?
  private var converterInput: CMAudioFormatDescription?

  init(format source: CMAudioFormatDescription) throws {
    guard let input = CMAudioFormatDescriptionGetStreamBasicDescription(source)?.pointee,
      input.mFormatID == kAudioFormatLinearPCM, input.mChannelsPerFrame > 0,
      input.mChannelsPerFrame <= UInt32.max / 4
    else { throw Self.invalid("Missing PCM format.") }
    output = AudioStreamBasicDescription(
      mSampleRate: input.mSampleRate, mFormatID: kAudioFormatLinearPCM,
      mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
      mBytesPerPacket: input.mChannelsPerFrame * 4, mFramesPerPacket: 1,
      mBytesPerFrame: input.mChannelsPerFrame * 4, mChannelsPerFrame: input.mChannelsPerFrame,
      mBitsPerChannel: 32, mReserved: 0)
    var description: CMAudioFormatDescription?
    guard
      CMAudioFormatDescriptionCreate(
        allocator: nil, asbd: &output, layoutSize: 0, layout: nil, magicCookieSize: 0,
        magicCookie: nil, extensions: nil, formatDescriptionOut: &description) == noErr,
      let description
    else { throw Self.invalid("Cannot establish canonical PCM format.") }
    format = description
  }
  deinit { if let converter { AudioConverterDispose(converter) } }

  func normalize(_ sample: CMSampleBuffer) throws -> CMSampleBuffer {
    guard let description = sample.formatDescription,
      var input = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee,
      input.mFormatID == kAudioFormatLinearPCM
    else { throw Self.invalid("Missing PCM input description.") }
    guard input.mSampleRate == output.mSampleRate,
      input.mChannelsPerFrame == output.mChannelsPerFrame
    else {
      throw CaptureFailure(
        "AUDIO_FORMAT_CHANGED", "Audio rate or channel count changed within a capture track.")
    }
    if input.mFormatFlags == output.mFormatFlags,
      input.mBytesPerPacket == output.mBytesPerPacket,
      input.mFramesPerPacket == output.mFramesPerPacket,
      input.mBytesPerFrame == output.mBytesPerFrame,
      input.mBitsPerChannel == output.mBitsPerChannel
    {
      return sample
    }
    if converterInput.map({ !CMFormatDescriptionEqual($0, otherFormatDescription: description) })
      ?? true
    {
      if let converter { AudioConverterDispose(converter) }
      converter = nil
      guard AudioConverterNew(&input, &output, &converter) == noErr, let converter else {
        throw Self.invalid("Cannot convert PCM representation.")
      }
      let mapping = (0..<output.mChannelsPerFrame).map { Int32($0) }
      let status = mapping.withUnsafeBytes {
        AudioConverterSetProperty(
          converter, kAudioConverterChannelMap, UInt32($0.count), $0.baseAddress!)
      }
      guard status == noErr else { throw Self.invalid("Cannot preserve PCM channel order.") }
      converterInput = description
    }
    let frames = sample.numSamples
    let byteCount = Int128(frames) * Int128(output.mBytesPerFrame)
    guard frames > 0, let frameCount = UInt32(exactly: frames),
      let bytes = UInt32(exactly: byteCount)
    else { throw Self.invalid("PCM buffer exceeds platform conversion bounds.") }
    let buffers =
      input.mFormatFlags & kAudioFormatFlagIsNonInterleaved != 0 ? Int(input.mChannelsPerFrame) : 1
    let source = AudioBufferList.allocate(maximumBuffers: buffers)
    defer { free(source.unsafeMutablePointer) }
    var block: CMBlockBuffer?
    guard
      CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
        sample, bufferListSizeNeededOut: nil, bufferListOut: source.unsafeMutablePointer,
        bufferListSize: MemoryLayout<AudioBufferList>.size + (buffers - 1)
          * MemoryLayout<AudioBuffer>.size,
        blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block
      ) == noErr
    else { throw Self.invalid("Cannot read PCM planes.") }
    var data = Data(count: Int(bytes))
    let converted: CMSampleBuffer = try data.withUnsafeMutableBytes { storage in
      var destination = AudioBufferList(
        mNumberBuffers: 1,
        mBuffers: AudioBuffer(
          mNumberChannels: output.mChannelsPerFrame, mDataByteSize: bytes,
          mData: storage.baseAddress!))
      let status = withExtendedLifetime(block) {
        AudioConverterConvertComplexBuffer(
          converter!, frameCount, source.unsafePointer, &destination)
      }
      guard status == noErr, destination.mBuffers.mDataByteSize == bytes else {
        throw Self.invalid("PCM conversion did not preserve its frame count.")
      }
      var result: CMSampleBuffer?
      guard
        // Live PCM callbacks may omit frame duration. CoreMedia derives it from the
        // canonical audio format; the callback still owns the first frame's timestamp.
        CMAudioSampleBufferCreateWithPacketDescriptions(
          allocator: nil, dataBuffer: nil, dataReady: false, makeDataReadyCallback: nil,
          refcon: nil, formatDescription: format, sampleCount: frames,
          presentationTimeStamp: sample.presentationTimeStamp, packetDescriptions: nil,
          sampleBufferOut: &result) == noErr,
        let result,
        CMSampleBufferSetDataBufferFromAudioBufferList(
          result, blockBufferAllocator: nil,
          blockBufferMemoryAllocator: nil, flags: 0, bufferList: &destination) == noErr
      else { throw Self.invalid("Cannot create canonical PCM buffer.") }
      return result
    }
    if let attachments = CMCopyDictionaryOfAttachments(
      allocator: nil, target: sample, attachmentMode: kCMAttachmentMode_ShouldPropagate)
    {
      CMSetAttachments(
        converted, attachments: attachments, attachmentMode: kCMAttachmentMode_ShouldPropagate)
    }
    return converted
  }
  private static func invalid(_ message: String) -> CaptureFailure {
    CaptureFailure("INVALID_AUDIO_FORMAT", message)
  }
}
