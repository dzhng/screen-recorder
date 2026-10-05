import CoreML
import Darwin
import FluidAudio
import Foundation

// Research only: explicit local bytes, no ModelHub download or preparation call.
let args = CommandLine.arguments
precondition(args.count == 5, "diarize MODEL_DIRECTORY PCM_F32LE OUTPUT_JSON CONFIG_JSON")
struct Recipe: Codable {
    let clusteringThreshold: Double
    let segmentationStepRatio: Double
    let minSegmentDuration: Double
}
let recipeBytes = try Data(contentsOf: URL(fileURLWithPath: args[4]))
let rawRecipe = try JSONSerialization.jsonObject(with: recipeBytes) as! [String: Any]
precondition(Set(rawRecipe.keys) == Set(["clusteringThreshold", "segmentationStepRatio", "minSegmentDuration"]), "Recipe permits only documented parameters, never reference speaker counts or identities")
let recipe = try JSONDecoder().decode(Recipe.self, from: recipeBytes)
precondition(recipe.clusteringThreshold > 0 && recipe.clusteringThreshold <= 2 && recipe.segmentationStepRatio > 0 && recipe.segmentationStepRatio <= 1 && recipe.minSegmentDuration >= 0, "Invalid documented configuration")
let entry = Date()
let modelDirectory = URL(fileURLWithPath: args[1])
let configuration = MLModelConfiguration()
configuration.computeUnits = .all
let fbankConfiguration = MLModelConfiguration()
fbankConfiguration.computeUnits = .cpuOnly
func model(_ name: String, _ config: MLModelConfiguration) throws -> MLModel {
    try MLModel(contentsOf: modelDirectory.appendingPathComponent(name + ".mlmodelc"), configuration: config)
}
let parameters = try JSONSerialization.jsonObject(with: Data(contentsOf: modelDirectory.appendingPathComponent("plda-parameters.json"))) as! [String: Any]
let tensors = parameters["tensors"] as! [String: Any]
let psi = tensors["psi"] as! [String: Any]
let psiBytes = Data(base64Encoded: psi["data_base64"] as! String)!
let psiValues = psiBytes.withUnsafeBytes { bytes in
    (0..<(bytes.count / 4)).map { Double(Float(bitPattern: UInt32(littleEndian: bytes.loadUnaligned(fromByteOffset: $0 * 4, as: UInt32.self)))) }
}
let manager = OfflineDiarizerManager(config: OfflineDiarizerConfig(clusteringThreshold: recipe.clusteringThreshold, segmentationStepRatio: recipe.segmentationStepRatio, minSegmentDuration: recipe.minSegmentDuration, exclusiveSegments: false))
manager.initialize(models: try OfflineDiarizerModels(
    segmentationModel: model("Segmentation", configuration),
    fbankModel: model("FBank", fbankConfiguration),
    embeddingModel: model("Embedding", configuration),
    pldaRhoModel: model("PldaRho", configuration),
    pldaPsi: psiValues,
    compilationDuration: Date().timeIntervalSince(entry)
))
let loaded = Date()
let pcm = try Data(contentsOf: URL(fileURLWithPath: args[2]))
precondition(pcm.count > 0 && pcm.count % 4 == 0 && pcm.count <= 16000 * 60 * 4)
let samples = pcm.withUnsafeBytes { bytes in
    (0..<(bytes.count / 4)).map { Float(bitPattern: UInt32(littleEndian: bytes.loadUnaligned(fromByteOffset: $0 * 4, as: UInt32.self))) }
}
let started = Date()
let result = try await manager.process(audio: samples)
let finished = Date()
var usage = rusage()
getrusage(RUSAGE_SELF, &usage)
let report: [String: Any] = [
    "segments": result.segments.map { ["speaker": $0.speakerId, "start": $0.startTimeSeconds, "end": $0.endTimeSeconds] as [String: Any] },
    "sampleRate": 16000,
    "audioSeconds": Double(samples.count) / 16000,
    "coldModelLoadSeconds": loaded.timeIntervalSince(entry),
    "audioReadSeconds": started.timeIntervalSince(loaded),
    "inferenceSeconds": finished.timeIntervalSince(started),
    "peakProcessRSSBytes": usage.ru_maxrss,
    "config": ["clusteringThreshold": recipe.clusteringThreshold, "segmentationStepRatio": recipe.segmentationStepRatio, "minSegmentDuration": recipe.minSegmentDuration, "exclusiveSegments": false],
]
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: args[3]), options: .withoutOverwriting)
