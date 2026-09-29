import Darwin
import Foundation
import ScreenRecorderMedia

/// Publication binds one immutable candidate to the journal prefix that describes its support.
package enum CaptureAudioPublication {
  package struct Intent: Codable, Sendable, Equatable {
    package let version: Int
    package let sourceID: String
    package let role: String
    package let payload: CaptureMediaIdentity
    package let journal: JournalPrefix
  }

  package struct Receipt: Codable, Sendable, Equatable {
    package let intent: Intent
    @JournalInteger package var acceptedFrames: Int64
    @JournalInteger package var committedFrames: Int64
    @JournalInteger package var representedFrames: Int64
    package let cleanPhysicalEOF: Bool
    package let diagnostic: String?
    package let canonical: CaptureMediaIdentity
    package let pcmSHA256: String
    package let supportSHA256: String

    init(intent: Intent, result: CaptureAudioMaterialization) throws {
      guard result.role == intent.role, result.payload == intent.payload,
        result.journal == intent.journal, let canonical = result.canonical,
        result.representedFrames > 0
      else { throw conflict("Candidate does not represent the pinned publication intent.") }
      self.intent = intent
      acceptedFrames = result.acceptedFrames
      committedFrames = result.committedFrames
      representedFrames = result.representedFrames
      cleanPhysicalEOF = result.cleanPhysicalEOF
      diagnostic = result.diagnostic
      self.canonical = canonical
      pcmSHA256 = result.pcmSHA256
      supportSHA256 = result.supportSHA256
    }
  }

  package enum Outcome: Sendable {
    case published(Receipt)
    /// The pinned attempt was inspected but represents no playable frames. Working bytes stay retained.
    case unavailable(Unavailable)
  }

  package enum Unavailable: Sendable {
    case noRepresentedFrames(CaptureAudioMaterialization)
    /// Mapping absence proves no placement, not a decoded count or an invented format.
    case missingMapping(Intent)
  }

  /// One explicit attempt; failures retain the packed payload and immutable restart intent.
  package static func publish(lease: CaptureJournalLease, role: String) async throws -> Outcome {
    try Task.checkCancellation()
    guard ["narration", "system"].contains(role) else { throw failure("Invalid publication role.") }
    try lease.check()
    let root = URL(fileURLWithPath: lease.directory)
    let attempt = root.appendingPathComponent(".capture-publication-\(role)")
    let intentURL = attempt.appendingPathComponent("intent.json")
    let candidate = attempt.appendingPathComponent("candidate.mov")
    let prepared = attempt.appendingPathComponent("prepared.json")
    let canonical = root.appendingPathComponent("\(role).mov")
    let published = root.appendingPathComponent("\(role).publication.json")

    if exists(published) {
      let receipt: Receipt = try read(published)
      guard receipt.intent.role == role else {
        throw conflict("Published receipt names a different role.")
      }
      try await verify(receipt, lease: lease, canonical: canonical)
      try synchronize(root)
      try lease.check()
      return .published(receipt)
    }

    try directory(attempt)
    let intent: Intent
    if exists(intentURL) {
      intent = try read(intentURL)
      _ = try validate(intent, lease: lease, role: role)
      guard
        try CaptureMediaIdentity.read(root.appendingPathComponent("\(role).packed.mov"))
          == intent.payload
      else { throw conflict("Packed payload no longer matches the publication intent.") }
    } else {
      let summary = try CaptureJournal.streamAcceptedPCM(lease: lease) { _ in }
      guard let prefix = summary.validatedPrefix, let header = summary.header,
        header.schemaVersion == 2
      else { throw failure("Publication requires accepted PCM journal evidence.") }
      intent = Intent(
        version: 1, sourceID: header.sessionID, role: role,
        payload: try CaptureMediaIdentity.read(root.appendingPathComponent("\(role).packed.mov")),
        journal: prefix)
      let payload = root.appendingPathComponent("\(role).packed.mov")
      _ = try NewFile.publish(staged: payload, at: payload.path)
      try lease.synchronize()
      try synchronize(root)
      try write(intent, to: intentURL)
      try synchronize(attempt)
      try synchronize(root)
    }

    // Without a prepared receipt no candidate has crossed a publication boundary. Rebuild the
    // owned partial candidate once; never reinterpret an already visible canonical filename.
    if !exists(prepared) {
      guard !exists(canonical) else {
        throw conflict("Canonical media has no prepared publication proof.")
      }
      if exists(candidate) {
        var info = stat()
        guard lstat(candidate.path, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
          info.st_uid == getuid(), info.st_nlink == 1
        else { throw conflict("Incomplete candidate is not an owned private file.") }
        guard unlink(candidate.path) == 0 else {
          throw failure("Cannot reset incomplete candidate.")
        }
      }
    }
    var hasMapping = false
    _ = try CaptureJournal.streamAcceptedPCM(lease: lease, through: intent.journal,
      track: { if $0.role == role { hasMapping = true } }) { _ in }
    if !hasMapping {
      guard !exists(prepared), !exists(candidate), !exists(canonical), !exists(published) else {
        throw conflict("Missing mapping conflicts with retained publication proof or media.")
      }
      try lease.check()
      return .unavailable(.missingMapping(intent))
    }
    let result = try await CaptureAudioMaterializer.materialize(
      lease: lease, through: intent.journal, role: role, candidate: candidate)
    guard result.role == intent.role, result.payload == intent.payload, result.journal == intent.journal else {
      throw conflict("Materialized result does not match the pinned publication intent.")
    }
    if result.representedFrames == 0 {
      guard result.canonical == nil, result.candidate == nil, !exists(prepared), !exists(candidate),
        !exists(canonical), !exists(published)
      else { throw conflict("Unavailable audio conflicts with retained publication proof or media.") }
      return .unavailable(.noRepresentedFrames(result))
    }
    let receipt = try Receipt(intent: intent, result: result)
    if exists(prepared) {
      let retained: Receipt = try read(prepared)
      guard retained == receipt else { throw conflict("Prepared publication facts changed.") }
    } else {
      // Persist candidate bytes before a durable receipt can authorize retrying this exact identity.
      _ = try NewFile.publish(staged: candidate, at: candidate.path)
      try synchronize(attempt)
      try write(receipt, to: prepared)
      try synchronize(attempt)
    }
    try lease.check()
    _ = try NewFile.publish(staged: candidate, at: canonical.path)
    try synchronize(root)
    try lease.check()
    _ = try NewFile.publish(staged: prepared, at: published.path)
    try synchronize(root)
    try lease.check()
    return .published(receipt)
  }

  /// Optional reclamation after publication. Failure leaves canonical availability intact and is
  /// surfaced to the caller as pending cleanup, not an invitation to repeat finalization.
  package static func cleanup(lease: CaptureJournalLease, receipt: Receipt) async throws {
    try Task.checkCancellation()
    let root = URL(fileURLWithPath: lease.directory)
    let role = receipt.intent.role
    guard ["narration", "system"].contains(role) else { throw failure("Invalid cleanup role.") }
    let receiptURL = root.appendingPathComponent("\(role).publication.json")
    let published: Receipt = try read(receiptURL)
    guard published == receipt else { throw failure("Cleanup receipt changed.") }
    let canonical = root.appendingPathComponent("\(role).mov")
    try await verify(receipt, lease: lease, canonical: canonical)
    guard receipt.cleanPhysicalEOF, receipt.diagnostic == nil,
      receipt.representedFrames == receipt.committedFrames,
      receipt.committedFrames == receipt.acceptedFrames
    else { return }
    // A retry may have observed links before the previous publisher synchronized the directory.
    try lease.synchronize()
    _ = try NewFile.publish(staged: canonical, at: canonical.path)
    _ = try NewFile.publish(staged: receiptURL, at: receiptURL.path)
    try synchronize(root)
    let payload = root.appendingPathComponent("\(role).packed.mov")
    if exists(payload) {
      var pinned = stat()
      guard lstat(payload.path, &pinned) == 0, pinned.st_mode & S_IFMT == S_IFREG
      else { throw failure("Packed cleanup input is not a regular file.") }
      let actual = try await CaptureAudioMaterializer.materialize(
        lease: lease, through: receipt.intent.journal, role: role, candidate: canonical)
      guard try Receipt(intent: receipt.intent, result: actual) == receipt,
        try CaptureMediaIdentity.read(payload) == receipt.intent.payload
      else { throw failure("Cleanup inputs no longer match verified publication.") }
      try lease.check()
      var current = stat()
      guard lstat(payload.path, &current) == 0, current.st_dev == pinned.st_dev,
        current.st_ino == pinned.st_ino
      else { throw failure("Packed cleanup input was replaced.") }
      guard unlink(payload.path) == 0 else {
        throw failure("Cannot remove verified packed working media.")
      }
      try synchronize(root)
    }
    let attempt = root.appendingPathComponent(".capture-publication-\(role)")
    if exists(attempt) {
      try directory(attempt)
      let intentURL = attempt.appendingPathComponent("intent.json")
      if exists(intentURL) {
        var pinnedIntent = stat()
        guard lstat(intentURL.path, &pinnedIntent) == 0,
          pinnedIntent.st_mode & S_IFMT == S_IFREG
        else { throw failure("Cleanup intent is not a regular file.") }
        let intent: Intent = try read(intentURL)
        guard intent == receipt.intent else { throw failure("Cleanup attempt identity changed.") }
        for (name, published) in [("candidate.mov", canonical), ("prepared.json", receiptURL)] {
          let path = attempt.appendingPathComponent(name)
          if exists(path) {
            try lease.check()
            var working = stat()
            var retained = stat()
            guard lstat(path.path, &working) == 0, lstat(published.path, &retained) == 0,
              working.st_mode & S_IFMT == S_IFREG, working.st_dev == retained.st_dev,
              working.st_ino == retained.st_ino
            else { throw failure("Cleanup member is not the published attempt inode.") }
            guard unlink(path.path) == 0 else {
              throw failure("Cannot remove published attempt member.")
            }
          }
        }
        try synchronize(attempt)
        var currentIntent = stat()
        guard lstat(intentURL.path, &currentIntent) == 0,
          currentIntent.st_dev == pinnedIntent.st_dev, currentIntent.st_ino == pinnedIntent.st_ino
        else { throw failure("Cleanup intent was replaced.") }
        guard unlink(intentURL.path) == 0 else {
          throw failure("Cannot remove completed publication intent.")
        }
        try synchronize(attempt)
      }
      // Intent removal is last. A restart with no intent may remove only an empty directory.
      try lease.check()
      guard rmdir(attempt.path) == 0 else {
        throw failure("Publication attempt retains cleanup work.")
      }
      try synchronize(root)
    }
    try lease.check()
  }

  /// Rechecks canonical bytes and delivered support without requiring already-cleaned working media.
  @discardableResult
  package static func verify(_ receipt: Receipt, lease: CaptureJournalLease, canonical: URL)
    async throws -> CaptureCanonicalAudio
  {
    let accepted = try validate(receipt.intent, lease: lease, role: receipt.intent.role)
    guard accepted == receipt.acceptedFrames, receipt.committedFrames >= 0,
      receipt.representedFrames > 0,
      receipt.representedFrames == min(receipt.acceptedFrames, receipt.committedFrames)
    else { throw conflict("Invalid represented prefix in publication receipt.") }
    let result = try await CaptureAudioMaterializer.verifyCanonical(
      lease: lease, through: receipt.intent.journal, role: receipt.intent.role,
      representedFrames: receipt.representedFrames, candidate: canonical)
    guard result.identity == receipt.canonical, result.pcmSHA256 == receipt.pcmSHA256,
      result.supportSHA256 == receipt.supportSHA256
    else { throw conflict("Published media no longer matches its receipt.") }
    return result
  }

  package struct VerifiedSource: Encodable, Sendable {
    package let canonical: CaptureMediaIdentity
    package let receipt: CaptureMediaIdentity
  }

  /// Admission reuses publication validation without retrying publication or touching working media.
  package static func readPublished(lease: CaptureJournalLease, role: String, canonical: URL)
    async throws -> (identity: VerifiedSource, audio: [JournalAudioSamples])
  {
    guard ["narration", "system"].contains(role) else { throw failure("Invalid publication role.") }
    let path = URL(fileURLWithPath: lease.directory).appendingPathComponent("\(role).publication.json")
    let before = try CaptureMediaIdentity.read(path)
    let receipt: Receipt = try read(path)
    guard receipt.intent.role == role else { throw conflict("Published receipt names a different role.") }
    let verified = try await verify(receipt, lease: lease, canonical: canonical)
    guard try CaptureMediaIdentity.read(path) == before else { throw conflict("Publication receipt changed.") }
    return (VerifiedSource(canonical: verified.identity, receipt: before), verified.acquiredAudio)
  }

  private static func validate(_ intent: Intent, lease: CaptureJournalLease, role: String) throws
    -> Int64
  {
    guard intent.version == 1, intent.role == role, ["narration", "system"].contains(role)
    else { throw conflict("Invalid publication intent.") }
    var accepted: Int64 = 0
    let summary = try CaptureJournal.streamAcceptedPCM(lease: lease, through: intent.journal) {
      if $0.role == role { accepted = $0.physicalFirstFrame + $0.frameCount }
    }
    guard summary.header?.sessionID == intent.sourceID, summary.header?.schemaVersion == 2
    else { throw conflict("Publication journal no longer matches the pinned intent.") }
    return accepted
  }

  private static func exists(_ url: URL) -> Bool {
    var info = stat()
    return lstat(url.path, &info) == 0
  }
  private static func directory(_ url: URL) throws {
    if mkdir(url.path, 0o700) != 0 && errno != EEXIST {
      throw failure("Cannot create publication attempt.")
    }
    var info = stat()
    guard lstat(url.path, &info) == 0, info.st_mode & S_IFMT == S_IFDIR,
      info.st_uid == getuid(), info.st_mode & 0o077 == 0
    else { throw conflict("Publication attempt must be an owned private directory.") }
  }
  private static func read<Value: Decodable>(_ url: URL) throws -> Value {
    let descriptor = open(url.path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
    guard descriptor >= 0 else { throw failure("Cannot read publication record.") }
    let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
    var info = stat()
    guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
      info.st_size <= 65_536
    else { throw failure("Publication record exceeds its bounded metadata format.") }
    var data = Data()
    while data.count <= 65_536 {
      try Task.checkCancellation()
      guard let chunk = try handle.read(upToCount: 65_537 - data.count), !chunk.isEmpty else {
        break
      }
      data.append(chunk)
    }
    guard data.count <= 65_536 else {
      throw failure("Publication record exceeds its bounded metadata format.")
    }
    do { return try JSONDecoder().decode(Value.self, from: data) }
    catch is DecodingError { throw conflict("Publication record is malformed.") }
  }
  private static func write<Value: Encodable>(_ value: Value, to url: URL) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    guard data.count <= 65_536 else {
      throw failure("Publication record exceeds its bounded metadata format.")
    }
    let output = try NewFile(at: url.path, assembledAs: "record.json")
    defer { output.discard() }
    try output.write(data)
    _ = try output.publish()
  }
  private static func synchronize(_ url: URL) throws {
    let descriptor = open(url.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    guard descriptor >= 0 else {
      throw failure("Cannot open publication directory for synchronization.")
    }
    defer { close(descriptor) }
    guard fsync(descriptor) == 0 else { throw failure("Cannot synchronize publication directory.") }
  }
  private static func conflict(_ message: String) -> CaptureFailure {
    CaptureFailure("PUBLICATION_CONFLICT", message)
  }
  private static func failure(_ message: String) -> CaptureFailure {
    CaptureFailure("PUBLICATION_FAILED", message)
  }
}
