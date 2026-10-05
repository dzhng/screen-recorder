import CoreML
import Darwin
import FluidAudio
import Foundation

// Research only: exact compiled local model, no ModelHub loading or download.
let args = CommandLine.arguments
precondition(args.count == 4, "sortformer MODEL_DIRECTORY PCM_F32LE OUTPUT_JSON")
let entry = Date()
let modelConfiguration = MLModelConfiguration()
modelConfiguration.computeUnits = .all
let model = try MLModel(contentsOf: URL(fileURLWithPath: args[1]).appendingPathComponent("Sortformer.mlmodelc"), configuration: modelConfiguration)
let config = SortformerConfig.default
let models = try SortformerModels(config: config, main: model)
let manager = SortformerDiarizer(config: config)
manager.initialize(models: models)
let loaded = Date()
let pcm = try Data(contentsOf: URL(fileURLWithPath: args[2]))
precondition(pcm.count > 0 && pcm.count % 4 == 0 && pcm.count <= 16000 * 60 * 4)
let samples = pcm.withUnsafeBytes { bytes in
    (0..<(bytes.count / 4)).map { Float(bitPattern: UInt32(littleEndian: bytes.loadUnaligned(fromByteOffset: $0 * 4, as: UInt32.self))) }
}
let started = Date()
let timeline = try manager.processComplete(samples, sourceSampleRate: 16000)
let finished = Date()
var usage = rusage()
getrusage(RUSAGE_SELF, &usage)
let segments = timeline.speakers.sorted { $0.key < $1.key }.flatMap { index, speaker in
    speaker.finalizedSegments.map { ["speaker": "S\(index)", "start": $0.startTime, "end": $0.endTime] as [String: Any] }
}
let report: [String: Any] = [
    "segments": segments,
    "finalizedPredictions": timeline.finalizedPredictions,
    "finalizedFrameCount": timeline.numFinalizedFrames,
    "sampleRate": 16000,
    "audioSeconds": Double(samples.count) / 16000,
    "coldModelLoadSeconds": loaded.timeIntervalSince(entry),
    "audioReadSeconds": started.timeIntervalSince(loaded),
    "inferenceSeconds": finished.timeIntervalSince(started),
    "peakProcessRSSBytes": usage.ru_maxrss,
    "config": "SortformerConfig.default, DiarizerTimelineConfig.sortformerDefault; 6/1/7 chunk/left/right;40FIFO;188cache",
]
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: args[3]), options: .withoutOverwriting)
