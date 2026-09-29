# Physical inputs end before durable capture finalization

The input session owns device selection, stream callbacks, cursor acquisition and
microphone observation. NativeCapture keeps the writer, source clock, generation
validation and termination/publication task. This lets physical inputs stop once
while durable finalization continues or retries. Production construction selects
ScreenCaptureKit; package-only fixture injection substitutes the input boundary,
not the writer or lifecycle owner.

The prerecorded test runs actual NativeCapture and CaptureWriter through generated
video buffers. It verifies partial-start teardown, a replacement take rejecting a
stale generation callback, real finalized/recovered duration agreement, and zero live
cursor sampling. The adapter creates only an inert SCStream callback identity;
it never queries shareable content, starts capture, enumerates a device or constructs
CursorSampler. Existing production configuration, selection/geometry and ordering of
cursor start, recording note and microphone observation are retained.

Native default tests, actual EFBIG preservation, app build and the five existing
controller races pass. Independent read-only review found no concrete configuration,
geometry, teardown, generation, observation or ownership regression. This checkpoint
proves the actual native body with prerecorded input; schema2 audio activation and
full controller/media/public admission remain separate required20d gates. No physical
capture, permission prompt, installation or download was performed.

Run the existing CaptureTests executable after building it; its default suite owns
this fixture. The app build and existing controller fixture pin the unchanged public
construction and controller consumers. Logs and worker identity are retained here.

[Combined-root verification](root-verification.json) retains the scoped replay results and logs.
