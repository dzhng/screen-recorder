import Foundation

if let output = ProcessInfo.processInfo.environment["SCREENREC_SELECTED_CAMERA_INPUT_OUTPUT"] {
  try await runSelectedCameraInputTests(output: output)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_CAMERA_SOURCE_PUBLICATION_OUTPUT"] {
  try await runCameraSourcePublicationTests(output: output)
} else if ProcessInfo.processInfo.environment["SCREENREC_CAMERA_PIXELS"] != nil {
  try await runProbeCameraPixelPublicationTests()
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_SELECTED_STOP_SCALE_OUTPUT"] {
  try await runSelectedCaptureStopScale(output: output, sourcePath: ProcessInfo.processInfo.environment["SCREENREC_SELECTED_STOP_SCALE_SOURCE"] ?? "")
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_SELECTED_STOP_OUTPUT"] {
  try await runSelectedCaptureStopTests(output: output)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_PROBE_REPLAY_OUTPUT"] {
  try await runProbeCameraReplayTests(source: ProcessInfo.processInfo.environment["SCREENREC_PROBE_REPLAY_INPUT"] ?? "", output: output)
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_SELECTED_FRAME_OUTPUT"] {
  try await runProbeFrameBoundary(output: output, sourcePath: ProcessInfo.processInfo.environment["SCREENREC_SELECTED_ADMITTED_SOURCE"])
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_SELECTED_PROBE_OUTPUT"] {
  try runSelectedCaptureRequestTests()
  try await runSelectedCaptureMediaTests(output: output,
    corpus: ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_CORPUS"] ?? "")
} else if ProcessInfo.processInfo.environment["SCREENREC_JOURNAL_LEASE_CHILD"] != nil {
  runCaptureJournalLeaseChild(directory: CommandLine.arguments[1])
} else if let output = ProcessInfo.processInfo.environment["SCREENREC_NATIVE_PUBLICATION_OUTPUT"] {
  try await runNativeCapturePublicationProbe(output: output,
    corpus: ProcessInfo.processInfo.environment["SCREENREC_CAPTURE_GAP_CORPUS"] ?? "")
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
  try await runProbeCameraPixelPublicationTests()
  try runSelectedCaptureRequestTests()
  try await runFractionalRecoveryDurationTest()
  try await runCaptureDurationTests()
  try await runNativeCaptureInputTests()
  try await runSelectedCameraInputTests()
  try await runCameraSourcePublicationTests()
  try await runCanonicalRecoveryTests()
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
