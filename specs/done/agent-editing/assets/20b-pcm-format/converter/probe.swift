import AudioToolbox
import AVFoundation
import Foundation
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let expected=try Data(contentsOf:root.appendingPathComponent("expected.f32le"))
var report:[[String:Any]]=[]
for (name,bits,isFloat,planar) in [("s16le",16,false,false),("s24le",24,false,false),("f64le",64,true,false),("planar",32,true,true),("f32le",32,true,false)] {
 let channels:UInt32=2
 let bytes=UInt32(bits/8)*(planar ? 1:channels)
 var source=AudioStreamBasicDescription(mSampleRate:48000,mFormatID:kAudioFormatLinearPCM,mFormatFlags:(isFloat ? kAudioFormatFlagIsFloat:kAudioFormatFlagIsSignedInteger)|kAudioFormatFlagIsPacked|(planar ? kAudioFormatFlagIsNonInterleaved:0),mBytesPerPacket:bytes,mFramesPerPacket:1,mBytesPerFrame:bytes,mChannelsPerFrame:channels,mBitsPerChannel:UInt32(bits),mReserved:0)
 var target=AudioStreamBasicDescription(mSampleRate:48000,mFormatID:kAudioFormatLinearPCM,mFormatFlags:kAudioFormatFlagIsFloat|kAudioFormatFlagIsPacked,mBytesPerPacket:8,mFramesPerPacket:1,mBytesPerFrame:8,mChannelsPerFrame:2,mBitsPerChannel:32,mReserved:0)
 var converter:AudioConverterRef?
 precondition(AudioConverterNew(&source,&target,&converter)==noErr)
 defer { AudioConverterDispose(converter!) }
 let mapping:[Int32]=[0,1]
 let mapped=mapping.withUnsafeBytes { AudioConverterSetProperty(converter!,kAudioConverterChannelMap,UInt32($0.count),$0.baseAddress!) }
 precondition(mapped==noErr)
 let input=AudioBufferList.allocate(maximumBuffers:planar ? 2:1)
 defer { for b in input { b.mData?.deallocate() };free(input.unsafeMutablePointer) }
 for index in input.indices {
  let filename=planar ? "plane-\(index).f32le":(name=="f32le" ? "expected.f32le":"input.\(name)")
  let data=try Data(contentsOf:root.appendingPathComponent(filename))
  let pointer=UnsafeMutableRawPointer.allocate(byteCount:data.count,alignment:16)
  data.copyBytes(to:pointer.assumingMemoryBound(to:UInt8.self),count:data.count)
  input[index]=AudioBuffer(mNumberChannels:planar ? 1:2,mDataByteSize:UInt32(data.count),mData:pointer)
 }
 var output=Data(count:expected.count)
 var actualBytes:UInt32=0
 let status=output.withUnsafeMutableBytes { storage in
  var list=AudioBufferList(mNumberBuffers:1,mBuffers:AudioBuffer(mNumberChannels:2,mDataByteSize:UInt32(storage.count),mData:storage.baseAddress!))
  let result=AudioConverterConvertComplexBuffer(converter!,1024,input.unsafePointer,&list)
  actualBytes=list.mBuffers.mDataByteSize
  return result
 }
 try output.write(to:root.appendingPathComponent("\(name)-output.f32le"))
 report.append(["format":name,"status":status,"frames":actualBytes/8,"exactPCM":output==expected])
 precondition(status==noErr && actualBytes==expected.count && output==expected)
}
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("report.json"))
