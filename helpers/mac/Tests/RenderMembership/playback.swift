@preconcurrency import AVFoundation
import CoreImage
import Foundation
import QuartzCore

// Observes AVPlayer's presentation output on its running clock. This is not a
// sample-reader probe or proof of AVPlayerLayer's final on-screen compositing.
@main struct Playback {
    @MainActor static func main() async throws {
        let source = URL(fileURLWithPath: CommandLine.arguments[1])
        let directory = URL(fileURLWithPath: CommandLine.arguments[2])
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let asset = AVURLAsset(url: source)
        let duration = try await asset.load(.duration).seconds
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let segments = try await track.load(.segments)
        let item = AVPlayerItem(asset: asset)
        let output = AVPlayerItemVideoOutput(pixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ])
        item.add(output)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        let context = CIContext()
        var events: [[String: Any]] = []
        let started = CACurrentMediaTime()
        var playing = false
        var imageNumber = 0
        var priorPresentation = "none acquired"
        var completed = false
        while CACurrentMediaTime() - started < 15 {
            if item.status == .failed {
                throw item.error ?? NSError(domain: "PlaybackProbe", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "AVPlayerItem failed without a detailed error"])
            }
            if item.status == .readyToPlay && !playing {
                player.play()
                playing = true
            }
            let host = CACurrentMediaTime()
            let time = output.itemTime(forHostTime: host)
            let current = player.currentTime().seconds
            var event: [String: Any] = [
                "elapsedSeconds": host - started,
                "currentSeconds": current.isFinite ? current : -1,
                "requestedSeconds": time.seconds.isFinite ? time.seconds : -1,
                "timeControlStatus": player.timeControlStatus.rawValue,
                "itemStatus": item.status.rawValue,
            ]
            if output.hasNewPixelBuffer(forItemTime: time) {
                var display = CMTime.invalid
                if let buffer = output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: &display) {
                    guard imageNumber < 128 else {
                        throw NSError(domain: "PlaybackProbe", code: 3,
                            userInfo: [NSLocalizedDescriptionKey: "Presentation image limit exceeded"])
                    }
                    let name = "presentation-\(imageNumber).png"
                    imageNumber += 1
                    try context.writePNGRepresentation(of: CIImage(cvPixelBuffer: buffer),
                        to: directory.appendingPathComponent(name), format: .RGBA8,
                        colorSpace: CGColorSpaceCreateDeviceRGB())
                    priorPresentation = name
                    event["acquisition"] = "image"
                    event["image"] = name
                } else {
                    // Apple's output contract permits a new nil reference to
                    // communicate that nothing should be displayed.
                    priorPresentation = "explicit no-display reference"
                    event["acquisition"] = "no-display"
                }
                event["displaySeconds"] = display.seconds.isFinite ? display.seconds : -1
            } else {
                // Absence of a new reference is not evidence of black pixels.
                event["acquisition"] = "no-new-reference"
            }
            event["lastAcquiredPresentation"] = priorPresentation
            events.append(event)
            if playing && current >= duration - 0.005 { completed = true; break }
            try await Task.sleep(for: .milliseconds(16))
        }
        player.pause()
        item.remove(output)
        let report: [String: Any] = [
            "source": source.lastPathComponent, "durationSeconds": duration,
            "completed": completed, "imagesAcquired": imageNumber,
            "observation": "AVPlayerItemVideoOutput on running host clock; no AVPlayerLayer pixel claim",
            "segments": segments.map { segment -> [String: Any] in
                ["empty": segment.isEmpty,
                 "startSeconds": segment.timeMapping.target.start.seconds,
                 "durationSeconds": segment.timeMapping.target.duration.seconds]
            },
            "events": events,
        ]
        let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: directory.appendingPathComponent("playback.json"))
        guard completed && imageNumber > 0 else {
            throw NSError(domain: "PlaybackProbe", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Playback did not finish with acquired pixels; see playback.json"])
        }
    }
}
