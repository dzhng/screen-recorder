import Foundation
import AVFoundation
import CryptoKit

func probe(_ count: Int, _ native: Double, _ speed: Double, _ channels: Int, _ chunk: Int, _ outChunk: Int, _ identityBits: Bool = false) throws -> [String: Any] {
 let requested = 48000 / speed
 guard let inf = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate:native, channels:UInt32(channels), interleaved:true), let outf = AVAudioFormat(commonFormat:.pcmFormatFloat32,sampleRate:requested,channels:UInt32(channels),interleaved:true), let conv = AVAudioConverter(from:inf,to:outf) else { return ["unsupported":true,"requested":requested] }
 var original = [Float](repeating:0,count:count*channels)
 for i in 0..<count { for c in 0..<channels {
 original[i*channels+c] = identityBits ? Float(bitPattern:[UInt32(0),0x80000000,1,0x80000001][i%4]) : Float(0.25*sin(2*Double.pi*Double(997+c*412)*Double(i)/native))
 } }
 let out = AVAudioPCMBuffer(pcmFormat:outf,frameCapacity:UInt32(outChunk))!
 var position=0, eos=0, calls=0, statuses:[String]=[], all=[Float](), maxRequest:UInt32=0
 var supplied:AVAudioPCMBuffer?
 while calls < 100000 {
  var error:NSError?
  let status=conv.convert(to:out,error:&error) { requestedPackets,status in
   maxRequest=max(maxRequest,requestedPackets)
   if position == count { status.pointee = .endOfStream; eos += 1; return nil }
   let n=min(chunk,count-position)
   let buffer=AVAudioPCMBuffer(pcmFormat:inf,frameCapacity:UInt32(n))!
   buffer.frameLength=UInt32(n)
   original.withUnsafeBufferPointer { b in buffer.floatChannelData![0].update(from:b.baseAddress!+position*channels,count:n*channels) }
   position += n; supplied=buffer; status.pointee = .haveData; return supplied
  }
  calls += 1
  all.append(contentsOf:UnsafeBufferPointer(start:out.floatChannelData![0],count:Int(out.frameLength)*channels))
  if status != .haveData { statuses.append("\(status.rawValue):\(out.frameLength)") }
  if status == .endOfStream || status == .error { if let error { statuses.append(error.description) }; break }
  if out.frameLength == 0 { break }
 }
 let digest=all.withUnsafeBytes { SHA256.hash(data:Data($0)).map{String(format:"%02x",$0)}.joined() }
 try all.withUnsafeBytes { try Data($0).write(to: URL(fileURLWithPath: "/tmp/screenrec-follow-feasibility-20260929/" + digest + ".f32")) }
 let exact = all.count == original.count && zip(all,original).allSatisfy{$0.bitPattern == $1.bitPattern}
 var crossings=[Int]()
 for c in 0..<channels { var n=0; if all.count/channels > 1 { for i in 1..<all.count/channels { if all[(i-1)*channels+c] <= 0 && all[i*channels+c] > 0 {n += 1} } }; crossings.append(n) }
 return ["inputFrames":count,"nativeRate":native,"speed":speed,"channels":channels,"chunk":chunk,"outputChunk":outChunk,"requestedOutputRate":requested,"acceptedOutputRate":conv.outputFormat.sampleRate,"outputFrames":all.count/channels,"nominalFrames":Double(count)*48000/native/speed,"consumed":position,"eosCallbacks":eos,"statuses":statuses,"calls":calls,"sha256":digest,"bitIdentity":exact,"zeroCrossings":crossings,"primeMethod":conv.primeMethod.rawValue,"leading":conv.primeInfo.leadingFrames,"trailing":conv.primeInfo.trailingFrames,"maxRequested":maxRequest]
}
var rows=[[String:Any]]()
for speed in [0.9,48000.0/53333.0,48000.0/53333.9] { rows.append(try probe(600000,48000,speed,1,4096,8192)) }
for n in [1,2,3,7,11,31,100,101,999,1001] { for speed in [0.8,0.9,1.25,1.23456789] { rows.append(try probe(n,48000,speed,1,4096,8192)) } }
for rate in [48000.0,44100.0] { for speed in [1.0,0.8,0.9,1.25,1.23456789] { for channels in [1,2] { rows.append(try probe(60474,rate,speed,channels,4096,8192)) } } }
for chunk in [1,127,4096,8192,4096] { rows.append(try probe(60474,48000,1.23456789,2,chunk,257)) }
for count in [1,2,10,100,4096] { rows.append(try probe(count,48000,0.9,1,127,257)) }
rows.append(try probe(12000,48000,1,1,127,257,true))
rows.append(try probe(12000,48000,1,2,127,257,true))
let data=try JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys]); FileHandle.standardOutput.write(data)
