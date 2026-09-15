@preconcurrency import AVFoundation
import Foundation

public func microseconds(_ time: CMTime) -> Int64 {
    CMTimeConvertScale(time, timescale: 1_000_000, method: .roundHalfAwayFromZero).value
}

public func time(microseconds value: Int64) -> CMTime {
    CMTime(value: value, timescale: 1_000_000)
}

/// One non-empty track segment: media sample timestamps on one side, asset presentation
/// timestamps on the other. An H.264 writer emits an edit list whenever frame reordering
/// shifts sample timestamps, and a trimmed or repositioned track shifts and scales them
/// further, so a sample cursor's timestamp is offset from the time the caller asks about.
/// Every reader of this package compares candidates in asset time through this one mapping.
public struct SourceSegment: Sendable {
    public let media: CMTimeRange
    public let asset: CMTimeRange

    public init(media: CMTimeRange, asset: CMTimeRange) {
        self.media = media
        self.asset = asset
    }

    /// The segments that carry media, in asset order. Empty edits present silence or blackness
    /// and hold no sample a cursor can reach.
    public static func occupied(of segments: [AVAssetTrackSegment]) -> [SourceSegment] {
        segments.filter { !$0.isEmpty }.map {
            SourceSegment(media: $0.timeMapping.source, asset: $0.timeMapping.target)
        }
    }

    public func assetTime(ofMedia time: CMTime) -> CMTime {
        CMTimeMapTimeFromRangeToRange(time, fromRange: media, toRange: asset)
    }

    public func mediaTime(ofAsset time: CMTime) -> CMTime {
        CMTimeMapTimeFromRangeToRange(time, fromRange: asset, toRange: media)
    }

    /// A media-domain duration expressed in asset time. An edit that stretches or compresses
    /// its segment makes these differ.
    public func assetDuration(ofMedia duration: CMTime) -> CMTime {
        CMTimeMapDurationFromRangeToRange(duration, fromRange: media, toRange: asset)
    }
}

/// The asset time at which the sample presented at `assetTime` stops being shown, or nil when no
/// cursor states it.
///
/// Sample cursors navigate media time and report media durations, so the requested asset time is
/// mapped into its segment first and the answer is mapped back. A cursor positions at or before
/// the time it is given, so a cursor that landed on some other sample proves nothing about this
/// one and yields nil rather than that sample's duration. Callers must report the absence; the
/// gap between two samples is not evidence of how long the last one lasted.
public func assetEnd(ofSamplePresentedAt assetTime: CMTime, in segments: [SourceSegment], of track: AVAssetTrack)
    -> CMTime?
{
    guard let segment = segments.first(where: { $0.asset.containsTime(assetTime) }) else { return nil }
    let mediaTime = segment.mediaTime(ofAsset: assetTime)
    guard let cursor = track.makeSampleCursor(presentationTimeStamp: mediaTime),
        microseconds(cursor.presentationTimeStamp) == microseconds(mediaTime)
    else { return nil }
    let duration = cursor.currentSampleDuration
    guard duration.isNumeric, duration > .zero else { return nil }
    // An edit can end mid-sample; the segment boundary is the last moment this sample is shown.
    return CMTimeMinimum(
        CMTimeAdd(assetTime, segment.assetDuration(ofMedia: duration)), CMTimeRangeGetEnd(segment.asset))
}
