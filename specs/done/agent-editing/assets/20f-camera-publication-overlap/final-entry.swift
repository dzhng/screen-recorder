import Foundation
@main enum FinalProbe {
 static func main() async throws {
  try await runProbeCameraPixelPublicationTests(widths: [32])
  try await runCameraPublicationClippedSupportTest()
  try await runCameraPublicationPrefixTests()
  try await runCameraPublicationErrorOrderTest()
  try runCameraPublicationDecisionTests()
  try await runCameraPublicationReplayTests()
 }
}
