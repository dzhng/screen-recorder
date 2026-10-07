import Foundation
import CoreML
import CryptoKit
import FluidAudio
import Darwin

func writeNew(_ path:String,_ value:Any) throws {
 let data=try JSONSerialization.data(withJSONObject:value,options:[.prettyPrinted,.sortedKeys]);try data.write(to:URL(fileURLWithPath:path),options:.withoutOverwriting)
}
func rss()->UInt64 {var r=rusage();getrusage(RUSAGE_SELF,&r);return UInt64(r.ru_maxrss)}
func segment(_ x:TimedSpeakerSegment)->[String:Any]{["speaker":x.speakerId,"start":x.startTimeSeconds,"end":x.endTimeSeconds,"embedding":x.embedding,"qualityScore":x.qualityScore]}
@main struct Reference {
 static func main() async {
  let saved=dup(STDOUT_FILENO)
  do {
   let request=try JSONSerialization.jsonObject(with:FileHandle.standardInput.readDataToEndOfFile()) as! [String:Any]
   let p=request["params"] as! [String:Any];let cases=p["cases"] as! [[String:Any]];let directory=p["modelDirectory"] as! String
   for c in cases {
    let raw=try Data(contentsOf:URL(fileURLWithPath:c["pcm"] as! String));let frames=c["frames"] as! Int
    guard raw.count==frames*4,String(SHA256.hash(data:raw).map{String(format:"%02x",$0)}.joined())==c["pcmSha256"] as! String else {throw NSError(domain:"input",code:1)}
    let finite=raw.withUnsafeBytes{buf in buf.bindMemory(to:Float.self).allSatisfy{$0.isFinite}}
    guard finite else {throw NSError(domain:"input",code:2)}
   }
   dup2(STDERR_FILENO,STDOUT_FILENO)
   ModelHub.offlineMode=true
   let load=Date();let modelConfig=MLModelConfiguration();modelConfig.computeUnits = .all
   let models=try await OfflineDiarizerModels.load(from:URL(fileURLWithPath:directory),configuration:modelConfig)
   let loadSeconds=Date().timeIntervalSince(load)
   var config=OfflineDiarizerConfig();config.postProcessing.exclusiveSegments=false;config.exposeChunkEmbeddings=true
   let manager=OfflineDiarizerManager(config:config);manager.initialize(models:models)
   var receipts:[[String:Any]]=[]
   for c in cases {
    let raw=try Data(contentsOf:URL(fileURLWithPath:c["pcm"] as! String));let audio=raw.withUnsafeBytes{Array($0.bindMemory(to:Float.self))}
    let start=Date();let result=try await manager.process(audio:audio);let seconds=Date().timeIntervalSince(start)
    let chunks=try JSONSerialization.jsonObject(with:JSONEncoder().encode(result.chunkEmbeddings ?? []))
    let segments=result.segments.map(segment)
    let timings:[String:Any]
    if let t=result.timings {timings=["modelCompilationSeconds":t.modelCompilationSeconds,"audioLoadingSeconds":t.audioLoadingSeconds,"segmentationSeconds":t.segmentationSeconds,"embeddingExtractionSeconds":t.embeddingExtractionSeconds,"speakerClusteringSeconds":t.speakerClusteringSeconds,"postProcessingSeconds":t.postProcessingSeconds,"totalInferenceSeconds":t.totalInferenceSeconds,"totalProcessingSeconds":t.totalProcessingSeconds]}else{timings=[:]}
    try writeNew(c["output"] as! String,["id":c["id"]!,"segments":segments,"chunkEmbeddings":chunks,"speakerDatabase":result.speakerDatabase ?? [:],"timings":timings,"audioSeconds":Double(audio.count)/16000,"sourceFrames":audio.count,"pcmSha256":c["pcmSha256"]!,"sampleRate":16000,"inferenceSeconds":seconds,"peakProcessRSSBytes":rss(),"modelLoadSeconds":loadSeconds,"completePublicObservations":true,"rawModelLogitsRetained":false])
    receipts.append(["id":c["id"]!,"inferenceSeconds":seconds,"RSSBytes":rss()])
   }
   fflush(stdout);dup2(saved,STDOUT_FILENO);close(saved)
   let out=try JSONSerialization.data(withJSONObject:["ok":true,"data":["offlineModelsLoaded":true,"modelLoadSeconds":loadSeconds,"cases":receipts]],options:[.sortedKeys]);FileHandle.standardOutput.write(out);FileHandle.standardOutput.write(Data([10]))
  }catch{
   fflush(stdout);dup2(saved,STDOUT_FILENO);close(saved)
   let out=try! JSONSerialization.data(withJSONObject:["ok":false,"error":["code":"reference_failure","message":String(describing:error),"retryable":false,"details":[:]]],options:[.sortedKeys]);FileHandle.standardOutput.write(out);FileHandle.standardOutput.write(Data([10]))
  }
 }
}
