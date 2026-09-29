import CoreMedia
import Foundation

/// Private journal integers retain their bits through JSON consumers, including JavaScript.
@propertyWrapper
package struct JournalInteger: Codable, Sendable, Equatable {
  package var wrappedValue: Int64
  package init(wrappedValue: Int64) { self.wrappedValue = wrappedValue }
  package init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    guard let integer = Int64(value), String(integer) == value else {
      throw CaptureFailure("INVALID_JOURNAL", "Invalid exact journal integer.")
    }
    wrappedValue = integer
  }
  package func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(String(wrappedValue))
  }
}

/// Raw evidence is retained independently of CaptureClock's admissibility policy.
package struct JournalRawTime: Codable, Sendable, Equatable {
  @JournalInteger package var value: Int64
  package let timescale: Int32
  @JournalInteger package var epoch: Int64
  package let flags: UInt32
  package init(_ time: CMTime) {
    value = time.value
    timescale = time.timescale
    epoch = time.epoch
    flags = time.flags.rawValue
  }
}

package struct JournalPCMOrigin: Codable, Sendable {
  package let rawPTS: JournalRawTime
  @JournalInteger package var declaredHostUs: Int64
  package init(rawPTS: CMTime, declaredHostUs: Int64) {
    self.rawPTS = JournalRawTime(rawPTS)
    self.declaredHostUs = declaredHostUs
  }
}

package struct JournalPCMTrack: Codable, Sendable {
  package let role: String
  package let file: String
  package let format: String
  package let rate: Int32
  package let channels: UInt32
  @JournalInteger package var phaseUs: Int64
  package init(role: String, rate: Int32, channels: UInt32, phaseUs: Int64) {
    self.role = role
    file = "\(role).packed.mov"
    format = "pcm-f32le-interleaved"
    self.rate = rate
    self.channels = channels
    self.phaseUs = phaseUs
  }
}

package struct JournalPCMAppend: Codable, Sendable {
  package let role: String
  @JournalInteger package var physicalFirstFrame: Int64
  @JournalInteger package var frameCount: Int64
  @JournalInteger package var declaredFirstFrame: Int64
  package let rawPTS: JournalRawTime
  @JournalInteger package var removedPauseUs: Int64
  package init(
    role: String, physicalFirstFrame: Int64, frameCount: Int64,
    declaredFirstFrame: Int64, rawPTS: CMTime, removedPauseUs: Int64
  ) {
    self.role = role
    self.physicalFirstFrame = physicalFirstFrame
    self.frameCount = frameCount
    self.declaredFirstFrame = declaredFirstFrame
    self.rawPTS = JournalRawTime(rawPTS)
    self.removedPauseUs = removedPauseUs
  }
}

/// At most two audio-role states; accepted mappings never accumulate in a summary.
struct JournalPCMState {
  private var hasOrigin = false
  private struct Track {
    var physicalEnd: Int64 = 0
    var declaredEnd: Int64 = 0
    var removedPauseUs: Int64 = 0
  }
  private var tracks: [String: Track] = [:]
  mutating func origin(_ origin: JournalPCMOrigin) throws {
    guard !hasOrigin, origin.declaredHostUs >= 0 else { throw invalid() }
    hasOrigin = true
  }
  mutating func track(_ track: JournalPCMTrack, header: CaptureJournalHeader) throws {
    guard hasOrigin, ["narration", "system"].contains(track.role),
      header.requested(track.role), tracks[track.role] == nil,
      track.file == "\(track.role).packed.mov", track.format == "pcm-f32le-interleaved",
      track.rate > 0, track.channels > 0, track.phaseUs >= 0
    else { throw invalid() }
    tracks[track.role] = Track()
  }
  mutating func append(_ append: JournalPCMAppend) throws {
    guard var track = tracks[append.role], append.frameCount > 0,
      append.physicalFirstFrame == track.physicalEnd,
      append.declaredFirstFrame >= track.declaredEnd,
      track.physicalEnd != 0 || append.declaredFirstFrame == 0,
      append.removedPauseUs >= track.removedPauseUs
    else { throw invalid() }
    let physical = append.physicalFirstFrame.addingReportingOverflow(append.frameCount)
    let declared = append.declaredFirstFrame.addingReportingOverflow(append.frameCount)
    guard !physical.overflow, !declared.overflow else { throw invalid() }
    track.physicalEnd = physical.partialValue
    track.declaredEnd = declared.partialValue
    track.removedPauseUs = append.removedPauseUs
    tracks[append.role] = track
  }
  private func invalid() -> CaptureFailure {
    CaptureFailure("INVALID_JOURNAL", "Invalid accepted PCM mapping sequence.")
  }
}
