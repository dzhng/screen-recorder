@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

/// Selects the sample whose own presentation timestamp is closest to `requestedUs` among the
/// samples inside `kept`. Earlier wins ties. Membership and distance are judged on the same
/// rounded microseconds the caller sees, so a boundary derived from a reported timestamp keeps
/// its own sample; the returned `CMTime` stays exact for decoding.
struct SampleSelector {
    let track: AVAssetTrack
    let segments: [SourceSegment]

    init(track: AVAssetTrack, segments: [AVAssetTrackSegment]) {
        self.track = track
        self.segments = SourceSegment.occupied(of: segments)
    }

    func nearestSample(toUs requestedUs: Int64, in kept: FrameInterval) -> (CMTime, Int64)? {
        var best: (CMTime, Int64)?
        for segment in segments {
            guard let candidate = nearestSample(toUs: requestedUs, in: kept, of: segment) else {
                continue
            }
            best = closer(best, candidate, toUs: requestedUs)
        }
        return best
    }

    private func nearestSample(toUs requestedUs: Int64, in kept: FrameInterval, of segment: SourceSegment)
        -> (CMTime, Int64)?
    {
        // Anchoring inside the interval keeps both walks adjacent to the kept material even when
        // the requested time sits far outside it.
        let anchorUs = min(max(requestedUs, kept.startUs), max(kept.startUs, kept.endUs - 1))
        let anchorAsset = CMTimeClampToRange(time(microseconds: anchorUs), range: segment.asset)
        guard let cursor = track.makeSampleCursor(presentationTimeStamp: segment.mediaTime(ofAsset: anchorAsset))
        else { return nil }

        let backward = walk(from: cursor, step: -1, in: kept, of: segment)
        let forward = walk(from: cursor, step: 1, in: kept, of: segment, skippingCurrent: true)
        return closer(backward, forward, toUs: requestedUs)
    }

    /// Walks presentation order from the cursor to the first sample inside the interval, stopping
    /// once the walk has passed the interval or run off the segment.
    private func walk(
        from cursor: AVSampleCursor, step: Int64, in kept: FrameInterval, of segment: SourceSegment,
        skippingCurrent: Bool = false
    ) -> (CMTime, Int64)? {
        guard let walker = cursor.copy() as? AVSampleCursor else { return nil }
        if skippingCurrent, walker.stepInPresentationOrder(byCount: step) != step { return nil }
        while segment.media.containsTime(walker.presentationTimeStamp) {
            let assetTime = segment.assetTime(ofMedia: walker.presentationTimeStamp)
            let assetUs = microseconds(assetTime)
            if assetUs >= kept.startUs && assetUs < kept.endUs { return (assetTime, assetUs) }
            if step < 0 && assetUs < kept.startUs { return nil }
            if step > 0 && assetUs >= kept.endUs { return nil }
            if walker.stepInPresentationOrder(byCount: step) != step { return nil }
        }
        return nil
    }

    private func closer(
        _ first: (CMTime, Int64)?, _ second: (CMTime, Int64)?, toUs requestedUs: Int64
    ) -> (CMTime, Int64)? {
        guard let first else { return second }
        guard let second else { return first }
        let firstDistance = abs(first.1 - requestedUs)
        let secondDistance = abs(second.1 - requestedUs)
        if firstDistance != secondDistance { return firstDistance < secondDistance ? first : second }
        return first.1 <= second.1 ? first : second
    }
}
