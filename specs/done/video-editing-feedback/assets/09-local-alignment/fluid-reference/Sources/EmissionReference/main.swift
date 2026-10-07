import Foundation
import CoreML
import CryptoKit
import FluidAudio
import Darwin
func rss()->UInt64{var r=rusage();getrusage(RUSAGE_SELF,&r);return UInt64(r.ru_maxrss)}
@main struct Reference {
 static func main() async {
  let saved=dup(STDOUT_FILENO)
  do {
   let request=try JSONSerialization.jsonObject(with:FileHandle.standardInput.readDataToEndOfFile()) as! [String:Any];let p=request["params"] as! [String:Any];let cases=p["cases"] as! [[String:Any]];let dir=URL(fileURLWithPath:p["modelDirectory"] as! String)
   for c in cases{let raw=try Data(contentsOf:URL(fileURLWithPath:c["pcm"] as! String));guard raw.count==(c["frames"] as! Int)*4,SHA256.hash(data:raw).map({String(format:"%02x",$0)}).joined()==c["pcmSha256"] as! String else{throw NSError(domain:"input",code:1)}}
   dup2(STDERR_FILENO,STDOUT_FILENO);ModelHub.offlineMode=true
   let load=Date();let models=try await CtcModels.loadDirect(from:dir,variant:.ctc110m);let tokenizer=try await CtcTokenizer.load(from:dir);let loadSeconds=Date().timeIntervalSince(load);let spotter=CtcKeywordSpotter(models:models)
   var receipts:[[String:Any]]=[]
   for c in cases {
    let data=try Data(contentsOf:URL(fileURLWithPath:c["pcm"] as! String));let audio=data.withUnsafeBytes{Array($0.bindMemory(to:Float.self))};guard audio.allSatisfy({$0.isFinite}) else{throw NSError(domain:"input",code:2)}
    let start=Date();let result=try await spotter.spotKeywordsWithLogProbs(audioSamples:audio,customVocabulary:CustomVocabularyContext(terms:[]));let seconds=Date().timeIntervalSince(start)
    let width=result.logProbs.first?.count ?? 0;let flat=result.logProbs.flatMap{$0};let nativeBytes=flat.withUnsafeBytes{Data($0)}
    let capture:[String:Any]=["id":c["id"]!,"shape":[result.totalFrames,width],"bytesBase64":nativeBytes.base64EncodedString(),"dtype":"<f4"];try JSONSerialization.data(withJSONObject:capture,options:[.sortedKeys]).write(to:URL(fileURLWithPath:(c["output"] as! String)+".native.json"),options:.withoutOverwriting)
    let texts=c["texts"] as! [String];let tokenizations=texts.map{text->[String:Any] in ["text":text,"ids":tokenizer.encode(text)]}
    let output:[String:Any]=["id":c["id"]!,"pcmSha256":c["pcmSha256"]!,"sourceFrames":audio.count,"audioSeconds":Double(audio.count)/16000,"sampleRate":16000,"blankId":spotter.blankId,"vocabulary":models.vocabulary.reduce(into:[String:String]()){$0[String($1.key)]=$1.value},"logProbs":result.logProbs,"nativeLogProbBytesBase64":nativeBytes.base64EncodedString(),"shape":[result.totalFrames,width],"frameDuration":result.frameDuration,"totalFrames":result.totalFrames,"tokenizations":tokenizations,"nativePublicEmissionScope":"Processed public CTC log-probs, temperature1/blankBias0; upstream padding trimming and chunk overlap semantics unchanged. Internal raw logits not claimed retained.","inferenceSeconds":seconds,"modelLoadSeconds":loadSeconds,"peakProcessRSSBytes":rss()]
    let raw=try JSONSerialization.data(withJSONObject:output,options:[.sortedKeys]);try raw.write(to:URL(fileURLWithPath:c["output"] as! String),options:.withoutOverwriting);receipts.append(["id":c["id"]!,"shape":[result.totalFrames,width],"seconds":seconds,"RSSBytes":rss()])
   }
   fflush(stdout);dup2(saved,STDOUT_FILENO);close(saved);let out=try JSONSerialization.data(withJSONObject:["ok":true,"data":["offlineModelsLoaded":true,"loadSeconds":loadSeconds,"cases":receipts]],options:[.sortedKeys]);FileHandle.standardOutput.write(out);FileHandle.standardOutput.write(Data([10]))
  }catch{fflush(stdout);dup2(saved,STDOUT_FILENO);close(saved);let out=try! JSONSerialization.data(withJSONObject:["ok":false,"error":["code":"CTC_REFERENCE_FAILURE","message":String(describing:error),"retryable":false,"details":[:]]],options:[.sortedKeys]);FileHandle.standardOutput.write(out);FileHandle.standardOutput.write(Data([10]))}
 }
}
