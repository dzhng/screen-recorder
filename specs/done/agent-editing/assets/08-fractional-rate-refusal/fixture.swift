@preconcurrency import AVFoundation
import Foundation
let url = URL(fileURLWithPath: "/tmp/screenrec-fractional-clock/impulses.caf")
let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44100.5, channels: 1, interleaved: true)!
let count = 396904
let file = try AVAudioFile(forWriting: url, settings: format.settings, commonFormat: .pcmFormatFloat32, interleaved: true)
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
buffer.frameLength = AVAudioFrameCount(count)
buffer.floatChannelData![0].initialize(repeating: 0, count: count)
for frame in [88201,352804] { buffer.floatChannelData![0][frame] = 0.75 }
try file.write(from: buffer)
print("Authored 396904 mono frames at44100.5Hz; impulses at88201 and352804 (exactly2s and8s).")
