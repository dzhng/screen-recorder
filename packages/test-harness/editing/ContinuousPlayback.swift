@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import QuartzCore

// This consumes timed player output offscreen; it cannot observe display presentation or sound.
@main struct ContinuousPlayback {
    struct Frame {
        let pts: CMTime
        let width: Int
        let height: Int
        let landmarks: [Int]
    }

    static func frame(_ pixel: CVPixelBuffer, pts: CMTime) -> Frame {
        CVPixelBufferLockBaseAddress(pixel, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixel, .readOnly) }
        let width = CVPixelBufferGetWidth(pixel), height = CVPixelBufferGetHeight(pixel)
        let stride = CVPixelBufferGetBytesPerRow(pixel)
        let bytes = CVPixelBufferGetBaseAddress(pixel)!.assumingMemoryBound(to: UInt8.self)
        var landmarks: [Int] = []
        // Interior spatial grid keeps polling cheap and makes geometry/color mismatches observable.
        for y in 0..<16 {
            for x in 0..<16 {
                let offset = ((2 * y + 1) * height / 32) * stride + ((2 * x + 1) * width / 32) * 4
                landmarks += [Int(bytes[offset + 2]), Int(bytes[offset + 1]), Int(bytes[offset])]
            }
        }
        return Frame(pts: pts, width: width, height: height, landmarks: landmarks)
    }

    static func time(_ pts: CMTime) -> [String: Any] {
        ["value": String(pts.value), "timescale": pts.timescale, "seconds": pts.seconds]
    }

    @MainActor static func main() async throws {
        guard CommandLine.arguments.count == 3 else {
            throw NSError(domain: "usage: ContinuousPlayback movie.mp4 report.json", code: 1)
        }
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        guard duration.isFinite, duration > 0, duration <= 30 else {
            throw NSError(domain: "Probe requires a movie between zero and 30 seconds", code: 1)
        }
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard tracks.count == 1 else { throw NSError(domain: "Probe requires one video track", code: 1) }
        let attributes: [String: Any] = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        let reader = try AVAssetReader(asset: asset)
        let decoded = AVAssetReaderTrackOutput(track: tracks[0], outputSettings: attributes)
        reader.add(decoded)
        guard reader.startReading() else { throw reader.error! }
        var reference: [Frame] = []
        while let sample = decoded.copyNextSampleBuffer() {
            guard reference.count < 1800 else { throw NSError(domain: "Probe frame bound exceeded", code: 1) }
            reference.append(frame(CMSampleBufferGetImageBuffer(sample)!, pts: CMSampleBufferGetPresentationTimeStamp(sample)))
        }
        guard reader.status == .completed, !reference.isEmpty else {
            throw reader.error ?? NSError(domain: "No decoded frames", code: 1)
        }

        let frameCadence = zip(reference, reference.dropFirst()).map { $1.pts.seconds - $0.pts.seconds }.max() ?? duration
        // Polling can be descheduled; this is a probe liveness allowance, not a display smoothness standard.
        let outputGapLimit = max(frameCadence, duration - reference.last!.pts.seconds) + 0.25
        let item = AVPlayerItem(asset: asset)
        let output = AVPlayerItemVideoOutput(pixelBufferAttributes: attributes)
        output.suppressesPlayerRendering = true
        item.add(output)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.volume = 0
        var completed = false
        var stalls: [Double] = []
        let started = CACurrentMediaTime()
        let endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime,
            object: item, queue: .main) { _ in completed = true }
        let stallObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemPlaybackStalled,
            object: item, queue: .main) { _ in stalls.append(CACurrentMediaTime() - started) }
        defer {
            player.pause()
            NotificationCenter.default.removeObserver(endObserver)
            NotificationCenter.default.removeObserver(stallObserver)
        }
        var observations: [[String: Any]] = []
        var progress: [[String: Any]] = []
        var observedIndices: [Int] = []
        var failures: [String] = []
        var previousState = ""
        var nextProgress = 0.0
        var lastPTS: CMTime?
        var maxLandmarkError = 0
        var firstOutputWall: Double?
        var previousOutputWall: Double?
        var maximumOutputGap = 0.0
        var sawPlaying = false
        player.play()
        while CACurrentMediaTime() - started < duration + 8 {
            let wall = CACurrentMediaTime() - started
            let state = "\(item.status.rawValue)/\(player.timeControlStatus.rawValue)"
            if player.timeControlStatus == .playing && player.rate == 1 { sawPlaying = true }
            if wall >= nextProgress || state != previousState || completed {
                progress.append(["wallSeconds": wall, "playerSeconds": player.currentTime().seconds,
                    "rate": player.rate, "itemStatus": item.status.rawValue,
                    "timeControlStatus": player.timeControlStatus.rawValue,
                    "waitingReason": player.reasonForWaitingToPlay?.rawValue ?? ""])
                nextProgress = wall + 0.1
                previousState = state
            }
            let requested = output.itemTime(forHostTime: CACurrentMediaTime())
            var displayed = CMTime.invalid
            if output.hasNewPixelBuffer(forItemTime: requested),
               let pixel = output.copyPixelBuffer(forItemTime: requested, itemTimeForDisplay: &displayed) {
                if firstOutputWall == nil { firstOutputWall = wall }
                if let previousOutputWall { maximumOutputGap = max(maximumOutputGap, wall - previousOutputWall) }
                previousOutputWall = wall
                let actual = frame(pixel, pts: displayed)
                let index = reference.firstIndex { CMTimeCompare($0.pts, displayed) == 0 }
                var observation: [String: Any] = ["wallSeconds": wall, "pts": time(displayed),
                    "playerSeconds": player.currentTime().seconds]
                if let index {
                    observedIndices.append(index)
                    let expected = reference[index]
                    let error = zip(actual.landmarks, expected.landmarks).map { abs($0 - $1) }.max()!
                    maxLandmarkError = max(maxLandmarkError, error)
                    observation["decodedIndex"] = index
                    observation["maximumRGBLandmarkError"] = error
                    if actual.width != expected.width || actual.height != expected.height {
                        failures.append("Player output dimensions differ at decoded index \(index)")
                    }
                } else { failures.append("Player output PTS absent from sequential decode: \(displayed)") }
                if let lastPTS, CMTimeCompare(displayed, lastPTS) <= 0 {
                    failures.append("Player output PTS did not strictly advance")
                }
                lastPTS = displayed
                observations.append(observation)
            }
            if firstOutputWall == nil && wall > 3 {
                failures.append("No player video output within three seconds of play request")
                break
            }
            if let previousOutputWall {
                maximumOutputGap = max(maximumOutputGap, wall - previousOutputWall)
                if wall - previousOutputWall > outputGapLimit {
                    break
                }
            }
            if completed || item.status == .failed { break }
            try await Task.sleep(nanoseconds: 2_000_000)
        }
        let wallDuration = CACurrentMediaTime() - started
        let observed = Set(observedIndices)
        let missing = reference.indices.filter { !observed.contains($0) }
        if maximumOutputGap > outputGapLimit {
            failures.append("Player video output stopped advancing beyond cadence plus scheduler allowance")
        }
        if let firstOutputWall, firstOutputWall > 3 { failures.append("First player output exceeded startup limit") }
        if !sawPlaying { failures.append("No observed playing state at rate one") }
        if !completed { failures.append("No playback completion notification before deadline") }
        if let error = item.error { failures.append(error.localizedDescription) }
        if !stalls.isEmpty { failures.append("Playback stall notification observed") }
        if !missing.isEmpty { failures.append("Player output missed \(missing.count) decoded frames") }
        if maxLandmarkError != 0 { failures.append("Player RGB landmarks differ from sequential decode") }
        if wallDuration < duration * 0.9 { failures.append("Playback finished faster than real time") }
        let report: [String: Any] = [
            "passed": failures.isEmpty, "failures": failures,
            "scope": "Muted offscreen AVPlayer continuous timed video output; no screen presentation, human smoothness, audible quality or A/V-sync claim",
            "movie": url.path,
            "movieSHA256": SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined(),
            "durationSeconds": duration, "wallDurationSeconds": wallDuration,
            "sawPlayingAtRateOne": sawPlaying,
            "firstOutputWallSeconds": firstOutputWall as Any? ?? NSNull(),
            "maximumOutputGapSeconds": maximumOutputGap, "outputGapLimitSeconds": outputGapLimit,
            "startupOutputLimitSeconds": 3,
            "muted": player.isMuted, "volume": player.volume, "completed": completed,
            "stallWallSeconds": stalls, "decodedFrameCount": reference.count,
            "observedFrameCount": observations.count, "missingDecodedIndices": missing,
            "maximumRGBLandmarkError": maxLandmarkError,
            "landmarkGrid": "16x16 interior pixel centers, RGB channels, exact match",
            "progress": progress, "observations": observations
        ]
        try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            .write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("\(failures.isEmpty ? "PASS" : "FAIL"): \(observations.count)/\(reference.count) frames, \(wallDuration)s wall, errors: \(failures)")
        if !failures.isEmpty { exit(1) }
    }
}
