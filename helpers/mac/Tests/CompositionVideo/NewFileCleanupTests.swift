import Darwin
import Foundation
import YapMedia

// The replacement contains unrelated bytes; discard owns only its original staging inode.
func checkNewFileCleanup(at directory: URL) throws {
  let manager = FileManager.default
  try manager.createDirectory(at: directory, withIntermediateDirectories: true)
  let output = try NewFile(
    at: directory.appendingPathComponent("output.mp4").path, assembledAs: "movie.mp4")
  let stage = output.url.deletingLastPathComponent()
  let held = directory.appendingPathComponent("renamed-owned-stage")
  try output.write(Data("owned unfinished movie".utf8))
  try manager.createDirectory(
    at: output.scratch(named: "nested"), withIntermediateDirectories: false)
  try Data("owned nested scratch".utf8).write(to: output.scratch(named: "nested/scratch"))
  try manager.moveItem(at: stage, to: held)
  try manager.createDirectory(at: stage, withIntermediateDirectories: false)
  let sentinel = stage.appendingPathComponent("sentinel")
  let expected = Data("unrelated replacement bytes".utf8)
  try expected.write(to: sentinel)
  try expected.write(to: directory.appendingPathComponent("sentinel-before.bytes"))
  output.discard()
  let actual = try? Data(contentsOf: sentinel)
  let owned = (try? manager.contentsOfDirectory(atPath: held.path)) ?? []
  let observation: [String: Any] = [
    "replacementExists": manager.fileExists(atPath: stage.path),
    "expectedSentinel": expected.base64EncodedString(),
    "actualSentinel": actual?.base64EncodedString() as Any? ?? NSNull(),
    "ownedMembers": owned,
    "published": manager.fileExists(atPath: directory.appendingPathComponent("output.mp4").path),
  ]
  try JSONSerialization.data(withJSONObject: observation, options: [.sortedKeys]).write(
    to: directory.appendingPathComponent("discard-observation.json"))
  precondition(
    manager.fileExists(atPath: stage.path), "Discard removed the unrelated replacement directory")
  precondition(actual == expected, "Discard changed the unrelated replacement sentinel")
  precondition(owned.isEmpty, "Discard must clean only its held original staging members")
  precondition(
    !manager.fileExists(atPath: held.path), "Discard must remove its renamed owned staging entry")
  output.discard()
  let afterRetry = try Data(contentsOf: sentinel)
  precondition(afterRetry == expected, "Repeated discard changed replacement bytes")
  let publishedPath = directory.appendingPathComponent("published.mp4")
  let published = try NewFile(at: publishedPath.path, assembledAs: "movie.mp4")
  let publishedStage = published.url.deletingLastPathComponent()
  let completed = Data("completed owned movie".utf8)
  try published.write(completed)
  let publishedBytes = try published.publish()
  precondition(publishedBytes == completed.count)
  published.discard()
  let visible = try Data(contentsOf: publishedPath)
  precondition(visible == completed)
  precondition(!manager.fileExists(atPath: publishedStage.path))

  let collisionPath = directory.appendingPathComponent("collision.mp4")
  let collision = try NewFile(at: collisionPath.path, assembledAs: "movie.mp4")
  let collisionStage = collision.url.deletingLastPathComponent()
  try collision.write(completed)
  try expected.write(to: collisionPath, options: .withoutOverwriting)
  do {
    _ = try collision.publish()
    preconditionFailure("Collision must refuse publication")
  } catch let failure as NativeFailure { precondition(failure.code == "INVALID_OUTPUT") }
  collision.discard()
  let occupied = try Data(contentsOf: collisionPath)
  precondition(occupied == expected)
  precondition(!manager.fileExists(atPath: collisionStage.path))

  let realParent = directory.appendingPathComponent("real-parent")
  let aliasParent = directory.appendingPathComponent("alias-parent")
  try manager.createDirectory(at: realParent, withIntermediateDirectories: false)
  try manager.createSymbolicLink(at: aliasParent, withDestinationURL: realParent)
  let alias = try NewFile(
    at: aliasParent.appendingPathComponent("initial-alias.mp4").path, assembledAs: "movie.mp4")
  let aliasStage = alias.url.deletingLastPathComponent()
  try alias.write(completed)
  _ = try alias.publish()
  alias.discard()
  let aliasBytes = try Data(contentsOf: realParent.appendingPathComponent("initial-alias.mp4"))
  precondition(aliasBytes == completed)
  precondition(!manager.fileExists(atPath: aliasStage.path))

  let source = directory.appendingPathComponent("source.bytes")
  let sourceAlias = directory.appendingPathComponent("source-symlink.bytes")
  let sourceHardLink = directory.appendingPathComponent("source-hardlink.bytes")
  try completed.write(to: source)
  try manager.createSymbolicLink(at: sourceAlias, withDestinationURL: source)
  try manager.linkItem(at: source, to: sourceHardLink)
  for occupiedSource in [source, sourceAlias, sourceHardLink] {
    do {
      _ = try NewFile(at: occupiedSource.path, assembledAs: "movie.mp4")
      preconditionFailure("A path output must refuse an existing source or alias")
    } catch let failure as NativeFailure {
      precondition(failure.code == "INVALID_OUTPUT")
    }
    let unchanged = try Data(contentsOf: occupiedSource)
    precondition(unchanged == completed)
  }

  func heldDescriptors(for path: URL) throws -> Int {
    var expected = stat()
    precondition(stat(path.path, &expected) == 0)
    return try manager.contentsOfDirectory(atPath: "/dev/fd").filter { name in
      guard let fd = Int32(name) else { return false }
      var current = stat()
      return fstat(fd, &current) == 0 && current.st_dev == expected.st_dev
        && current.st_ino == expected.st_ino
    }.count
  }
  var retained: NewFile? = try NewFile(
    at: directory.appendingPathComponent("unpublished.mp4").path, assembledAs: "movie.mp4")
  let retainedStage = retained!.url.deletingLastPathComponent()
  let retainedFile = retained!.url
  try retained!.write(completed)
  let descriptorsBefore = try heldDescriptors(for: retainedStage)
  retained = nil
  let descriptorsAfter = try heldDescriptors(for: retainedStage)
  let retainedBytes = try Data(contentsOf: retainedFile)
  try JSONSerialization.data(
    withJSONObject: [
      "heldBefore": descriptorsBefore, "heldAfter": descriptorsAfter,
      "retainedBytes": retainedBytes.base64EncodedString(),
    ], options: [.sortedKeys]
  ).write(to: directory.appendingPathComponent("retained-observation.json"))
  precondition(
    descriptorsBefore == 1 && descriptorsAfter == 0,
    "Releasing retained candidates must close their directory descriptor")
  precondition(
    retainedBytes == completed, "Releasing a retained candidate must preserve its recovery bytes")
  print(
    "PASS replacement sentinel, renamed owned cleanup, repeat/retained descriptor close, initial parent alias and publication/collision"
  )
}

func checkNewFilePublication(at directory: URL) throws {
  let manager = FileManager.default
  try manager.createDirectory(at: directory, withIntermediateDirectories: true)
  let destination = directory.appendingPathComponent("published.json")
  let output = try NewFile(at: destination.path, assembledAs: "record.json")
  let stage = output.url.deletingLastPathComponent()
  let held = directory.appendingPathComponent("renamed-owned-stage")
  let owned = Data("{\"owner\":\"assembled\"}".utf8)
  let foreign = Data("{\"owner\":\"unrelated replacement bytes\"}".utf8)
  try output.write(owned)
  try manager.moveItem(at: stage, to: held)
  try manager.createDirectory(at: stage, withIntermediateDirectories: false)
  try foreign.write(to: output.url)
  var bytes: Int?
  var refusal: NativeFailure?
  do { bytes = try output.publish() } catch let failure as NativeFailure { refusal = failure }
  let visible = try? Data(contentsOf: destination)
  let external = try Data(contentsOf: output.url)
  try JSONSerialization.data(
    withJSONObject: [
      "expectedOwned": owned.base64EncodedString(),
      "expectedForeign": foreign.base64EncodedString(),
      "visible": visible?.base64EncodedString() as Any? ?? NSNull(),
      "replacement": external.base64EncodedString(),
      "receiptBytes": bytes as Any? ?? NSNull(),
      "refusal": refusal?.code as Any? ?? NSNull(),
    ], options: [.sortedKeys]
  ).write(to: directory.appendingPathComponent("publication-observation.json"))
  precondition(
    visible == owned && bytes == owned.count,
    "Publication receipt named foreign replacement bytes as its assembled output")
  precondition(refusal == nil)
  let repeated = try output.publish()
  precondition(repeated == owned.count)
  precondition(external == foreign, "Publication changed unrelated replacement bytes")
  output.discard()
  let surviving = try Data(contentsOf: stage.appendingPathComponent("record.json"))
  precondition(surviving == foreign)
  let writeBound = try NewFile(
    at: directory.appendingPathComponent("write-bound.json").path, assembledAs: "record.json")
  let writeStage = writeBound.url.deletingLastPathComponent()
  let writeHeld = directory.appendingPathComponent("write-renamed-owned-stage")
  try manager.moveItem(at: writeStage, to: writeHeld)
  try manager.createDirectory(at: writeStage, withIntermediateDirectories: false)
  try foreign.write(to: writeBound.url)
  try writeBound.write(owned)
  let writtenOwned = try Data(contentsOf: writeHeld.appendingPathComponent("record.json"))
  let unchangedReplacement = try Data(contentsOf: writeBound.url)
  precondition(writtenOwned == owned && unchangedReplacement == foreign)
  _ = try writeBound.publish()
  writeBound.discard()

  let selectedParent = directory.appendingPathComponent("selected-parent")
  let movedParent = directory.appendingPathComponent("renamed-parent")
  try manager.createDirectory(at: selectedParent, withIntermediateDirectories: false)
  let parentChanged = try NewFile(
    at: selectedParent.appendingPathComponent("output.json").path, assembledAs: "record.json")
  try parentChanged.write(owned)
  try manager.moveItem(at: selectedParent, to: movedParent)
  try manager.createDirectory(at: selectedParent, withIntermediateDirectories: false)
  try foreign.write(to: selectedParent.appendingPathComponent("sentinel"))
  do {
    _ = try parentChanged.publish()
    preconditionFailure("Changed requested parent must refuse before linking")
  } catch let failure as NativeFailure { precondition(failure.code == "INVALID_OUTPUT") }
  precondition(!manager.fileExists(atPath: movedParent.appendingPathComponent("output.json").path))
  precondition(
    !manager.fileExists(atPath: selectedParent.appendingPathComponent("output.json").path))
  parentChanged.discard()
  let parentSentinel = try Data(contentsOf: selectedParent.appendingPathComponent("sentinel"))
  precondition(parentSentinel == foreign)

  let leafDestination = directory.appendingPathComponent("leaf-swap.json")
  let leafChanged = try NewFile(at: leafDestination.path, assembledAs: "record.json")
  try leafChanged.write(owned)
  try manager.moveItem(at: leafChanged.url, to: leafChanged.scratch(named: "original.json"))
  try foreign.write(to: leafChanged.url)
  do {
    _ = try leafChanged.publish()
    preconditionFailure("Known written inode replacement must refuse")
  } catch let failure as NativeFailure { precondition(failure.code == "INVALID_OUTPUT") }
  precondition(!manager.fileExists(atPath: leafDestination.path))
  leafChanged.discard()

  let lateTarget = directory.appendingPathComponent("late-target.json")
  let late = try NewFile(at: lateTarget.path + "/", assembledAs: "record.json")
  try late.write(owned)
  do {
    _ = try late.publish()
    preconditionFailure("Invalid exact locator must not receive a receipt")
  } catch let failure as NativeFailure {
    precondition(
      failure.code == "INVALID_OUTPUT"
        && failure.message == "Output locator changed before its receipt.")
  }
  precondition(
    !manager.fileExists(atPath: lateTarget.path),
    "Failed receipt must undo only its newly created owned link")
  late.discard()
  let idempotent = try NewFile.publish(staged: destination, at: destination.path)
  precondition(idempotent == owned.count)
  do {
    _ = try NewFile.publish(staged: destination, at: destination.path + "/")
    preconditionFailure("Invalid exact locator must refuse")
  } catch let failure as NativeFailure { precondition(failure.code == "INVALID_OUTPUT") }
  let retainedVisible = try Data(contentsOf: destination)
  precondition(
    retainedVisible == owned, "Failed idempotent receipt must not unlink a preexisting owned output"
  )
  print(
    "PASS held publication, known inode/parent refusal, created-link rollback and retained EEXIST")
}
