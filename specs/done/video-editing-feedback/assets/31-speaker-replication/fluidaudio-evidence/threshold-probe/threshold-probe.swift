import Foundation
import FluidAudio
import CoreML
import CryptoKit

struct CaseSpec { let id: String; let path: String; let frames: Int; let sha256: String }
struct Output: Encodable { let id: String; let threshold: Double; let sourceFrames: Int; let audioSeconds: Double; let inferenceSeconds: Double; let segments: [Segment]; let chunkEmbeddings: [ChunkEmbedding] }
struct Segment: Encodable { let speaker: String; let start: Double; let end: Double }
func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

@main struct Main {
    static func main() async throws {
        let modelPath = "/private/tmp/yap-editing-speaker-replication/fluidaudio-model-library/models/community1-speaker-research-r2/df2625ac79a7ac6b65ad868fee6d80f320da4232"
        let cases = [
            CaseSpec(id: "bspxd30", path: "/tmp/yap-editing-speaker-replication/bspxd.f32", frames: 480000, sha256: "9ba2131687811bfbb9fb08d915648738cd83b35476370b55ae95b5c809133bb1"),
            CaseSpec(id: "returns-overlap-silence", path: "/tmp/yap-editing-speaker-replication/continuity/returns-overlap-silence.f32", frames: 1600000, sha256: "e97f8450c758696193a8b9a8d0468217e24fa22a2d12631a2c37fa6eb20e9068")
        ]
        let thresholds: [Double] = [0.3, 0.4, 0.5, 0.6]
        var cfg = OfflineDiarizerConfig(); cfg.postProcessing.exclusiveSegments = false; cfg.exposeChunkEmbeddings = true
        let prepManager = OfflineDiarizerManager(config: cfg)
        var mlConfig = MLModelConfiguration(); mlConfig.computeUnits = .all
        ModelHub.offlineMode = true
        let models = try await OfflineDiarizerModels.load(from: URL(fileURLWithPath: modelPath), configuration: mlConfig)
        prepManager.initialize(models: models)
        var prepared: [(CaseSpec, PreparedDiarization)] = []
        for c in cases {
            let data = try Data(contentsOf: URL(fileURLWithPath: c.path)); guard data.count == c.frames * 4, hash(data) == c.sha256 else { throw NSError(domain: "input", code: 1) }
            let samples = data.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
            prepared.append((c, try await prepManager.prepare(audio: samples)))
        }
        var out: [Output] = []
        for threshold in thresholds {
            var c = cfg; c.clustering.threshold = threshold
            let manager = OfflineDiarizerManager(config: c); manager.initialize(models: models)
            for (spec, value) in prepared {
                let started = Date(); let result = try manager.cluster(value); let elapsed = Date().timeIntervalSince(started)
                let segments = result.segments.map { Segment(speaker: $0.speakerId, start: Double($0.startTimeSeconds), end: Double($0.endTimeSeconds)) }
                out.append(Output(id: spec.id, threshold: threshold, sourceFrames: spec.frames, audioSeconds: Double(spec.frames)/16000.0, inferenceSeconds: elapsed, segments: segments, chunkEmbeddings: result.chunkEmbeddings ?? []))
            }
        }
        let data = try JSONEncoder().encode(out); try data.write(to: URL(fileURLWithPath: "/tmp/yap-community-threshold-probe/results.json")); print(String(data: data, encoding: .utf8)!)
    }
}
