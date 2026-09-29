import Foundation

if let output = ProcessInfo.processInfo.environment["SCREENREC_PCM_ADMISSION_OUTPUT"] {
  try await runPCMAdmissionProbe(
    output: output,
    canonical: ProcessInfo.processInfo.environment["SCREENREC_PCM_ADMISSION_CANONICAL"] ?? "")
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_OUTPUT"],
  let corpus = ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_CORPUS"]
{
  try await runCaptureAudioGapProbe(output: output, corpus: corpus)
} else {
  try await runFractionalRecoveryDurationTest()
  try await runCaptureDurationTests()
  try await runCaptureTerminationTests()
  try runCaptureWriterTests()
  runCaptureClockTests()
  await runHeldTailFrameTests()
  try await runCaptureJournalTests()
  try await runDeferredPauseTests()
  try runCursorGeometryTests()
  try await runMediaRecoveryTests()
  runCaptureExclusionTests()
}
