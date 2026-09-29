import Foundation

if ProcessInfo.processInfo.environment["SCREENREC_JOURNAL_LEASE_CHILD"] != nil {
  runCaptureJournalLeaseChild(directory: CommandLine.arguments[1])
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_MATERIALIZER_DESCRIPTOR_OUTPUT"] {
  try await runCaptureAudioMaterializerDescriptorProbe(output: output)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_MATERIALIZER_OUTPUT"] {
  try await runCaptureAudioMaterializerScaleProbe(output: output, runs: Int(ProcessInfo.processInfo.environment["SCREENREC_MATERIALIZER_RUNS"] ?? "128")!)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_PUBLICATION_OUTPUT"] {
  try await runCaptureAudioPublicationTests(output: output)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_AUDIO_FORMAT_OUTPUT"] {
  try await runCaptureAudioFormatProbe(
    output: output,
    corpus: ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_CORPUS"] ?? "",
    stereoFixture: ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_FORMAT_STEREO"] ?? "")
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_JOURNAL_FAILURE_OUTPUT"] {
  try await runCaptureJournalFailureProbe(
    output: output,
    corpus: ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_CORPUS"] ?? "")
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_PCM_WINDOWS_OUTPUT"] {
  try await runPCMAdmissionWindows(
    output: output,
    canonical: ProcessInfo.processInfo.environment["SCREENREC_PCM_WINDOWS_CANONICAL"] ?? "")
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_PCM_ADMISSION_OUTPUT"] {
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
  try await runNativeCaptureInputTests()
  try await runCaptureTerminationTests()
  try await runCaptureWriterTests()
  runCaptureClockTests()
  await runHeldTailFrameTests()
  try await runCaptureJournalTests()
  try runCaptureJournalLeaseTests()
  try runPCMJournalTests()
  try await runCaptureAudioMaterializerTests()
  try await runCaptureAudioPublicationTests()
  try await runDeferredPauseTests()
  try runCursorGeometryTests()
  try await runMediaRecoveryTests()
  runCaptureExclusionTests()
}
