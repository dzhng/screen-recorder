@preconcurrency import AVFoundation
import Foundation
let directory = URL(fileURLWithPath: "/tmp/screenrec-audio-admission")
func fixture(
    rate: Double, channels: Int, name: String, poison: Bool = false, discrete: Bool = false,
    seconds: Double = 1.1
) throws -> URL {
    let url = directory.appendingPathComponent(name + ".caf")
    let format =
        channels > 2 || discrete
        ? AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: rate, interleaved: true,
            channelLayout: AVAudioChannelLayout(
                layoutTag: kAudioChannelLayoutTag_DiscreteInOrder | UInt32(channels))!)
        : AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: rate,
            channels: AVAudioChannelCount(channels), interleaved: true)!
    let file = try AVAudioFile(
        forWriting: url, settings: format.settings, commonFormat: .pcmFormatFloat32,
        interleaved: true)
    let count = Int(rate * seconds)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
    buffer.frameLength = AVAudioFrameCount(count)
    for frame in 0..<count {
        for channel in 0..<channels {
            let excluded = frame >= Int(rate * 0.2) && frame < Int(rate * 0.3)
            buffer.floatChannelData![0][frame * channels + channel] =
                poison && excluded
                ? (channel == 0 ? 0.99 : -0.99) : Float((frame * (channel + 3)) % 101 - 50) / 100
        }
    }
    try file.write(from: buffer)
    return url
}

for (rate, channels, discrete, name) in [(44100.5, 2, false, "fractional"), (48000.0, 4, true, "four-channel"), (48000.0, 2, true, "discrete-stereo")] {
 print(try fixture(rate: rate, channels: channels, name: name, discrete: discrete).path)
}
