import AVFoundation
import Foundation

// Research-only raw mono Float32 runner. Manual rendering never opens speaker output.
struct Request: Decodable {
    let input: String
    let output: String
    let startFrame: Int
    let endFrame: Int
    let speed: Float
    let outputFrames: Int
}
let request = try JSONDecoder().decode(
    Request.self, from: FileHandle.standardInput.readDataToEndOfFile())
guard request.speed > 0, request.outputFrames > 0, request.outputFrames <= 48_000 * 60 else {
    fatalError("Probe request exceeds its one-minute bound")
}
let data = try Data(contentsOf: URL(fileURLWithPath: request.input))
guard data.count % 4 == 0, data.count <= 48_000 * 180 * 4 else { fatalError("Invalid PCM") }
guard request.startFrame >= 0, request.endFrame > request.startFrame,
    request.endFrame <= data.count / 4, request.endFrame - request.startFrame <= 48_000 * 60
else { fatalError("Invalid selected source range") }
let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
let input = AVAudioPCMBuffer(
    pcmFormat: format, frameCapacity: AVAudioFrameCount(request.endFrame - request.startFrame))!
input.frameLength = input.frameCapacity
data.withUnsafeBytes { bytes in
    input.floatChannelData![0].update(
        from: bytes.bindMemory(to: Float.self).baseAddress!.advanced(by: request.startFrame),
        count: Int(input.frameLength))
}
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
let pitch = AVAudioUnitTimePitch()
pitch.rate = request.speed
pitch.pitch = 0
pitch.overlap = 8
engine.attach(player)
engine.attach(pitch)
engine.connect(player, to: pitch, format: format)
engine.connect(pitch, to: engine.mainMixerNode, format: format)
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
player.scheduleBuffer(input)
try engine.start()
player.play()
defer {
    player.stop()
    engine.stop()
}
let rendered = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
var output = Data(capacity: request.outputFrames * 4)
var attempts = 0
let start = ContinuousClock.now
while output.count / 4 < request.outputFrames {
    attempts += 1
    guard attempts <= request.outputFrames / 4096 + 1000 else {
        fatalError("Render made no bounded progress")
    }
    let frames = AVAudioFrameCount(min(4096, request.outputFrames - output.count / 4))
    let status = try engine.renderOffline(frames, to: rendered)
    switch status {
    case .success:
        guard rendered.frameLength > 0 else { fatalError("No rendered frames") }
        output.append(
            UnsafeBufferPointer(
                start: rendered.floatChannelData![0], count: Int(rendered.frameLength)))
    case .insufficientDataFromInputNode: fatalError("Unexpected input-node starvation")
    case .cannotDoInCurrentContext: continue
    case .error: fatalError("Offline render failed")
    @unknown default: fatalError("Unknown render status")
    }
}
try output.write(to: URL(fileURLWithPath: request.output), options: .withoutOverwriting)
let elapsed = start.duration(to: .now).components
let result: [String: Any] = [
    "frames": output.count / 4, "latencySeconds": pitch.auAudioUnit.latency,
    "tailSeconds": pitch.auAudioUnit.tailTime, "speed": request.speed,
    "renderSeconds": Double(elapsed.attoseconds) / 1e18 + Double(elapsed.seconds),
    "manualRendering": "offline", "overlap": pitch.overlap,
]
print(
    String(
        data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]),
        encoding: .utf8)!)
