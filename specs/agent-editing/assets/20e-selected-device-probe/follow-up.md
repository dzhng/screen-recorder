# Separate physical follow-up — not executed

Reviewable scratch assembly: `/tmp/screenrec-20e-reviewed-app/ScreenRecorder.app`.
Its Info.plist says `com.david.screenrec`; executable SHA256 is
`4e6d6d9fbd7ba193c5beec5b2dbc80d767fecfc7f5a7062066a73a2bd668f8bf`.
Read-only signature display reports an embedded linker ad-hoc signature:

- Signature identifier: `ScreenRecorder-555549447e7f794c38e63d47b69a4e74525358ff`.
- CDHash: `2c03df87e3700dc586db8343e2d2762f44191ad4`.
- No team identifier, bound Info.plist or sealed resources.

This is a probe-only assembly, without normal app service resources. It was never
launched. It must not be described as a verified TCC identity or as inheriting the
installed application's grants. Any stable app signing/preparation and permission
request are separate authorized actions; this pass performed none. The complete
bundle inventory and signature display are retained in the archive.

After the user authorizes discovery under the reviewed identity, the explicit
source-list command is (run from the repository):

```sh
node packages/test-harness/editing/camera-reproduction.mjs --case shared-clock \
  --action sources \
  --app /tmp/screenrec-20e-reviewed-app/ScreenRecorder.app/Contents/MacOS/ScreenRecorder
```

Discovery requires an existing screen grant and does not request one. Permission
inspection and each permission request are distinct actions in the probe dispatcher;
none are authorized implicitly by the command above. Do not guess or substitute
selected device IDs. Once discovery/selection is authorized, prepare and show the
complete request using SelectedCaptureRequest's schema: explicit screen/window/region,
camera ID, microphone ID or disabled, new absolute output directory, fps, duration,
optional pause and camera delay. The parent20 schedule must include at least ten
active minutes and shared visible/audible landmarks; actual IDs and destination
must be reviewed before capture.

The separate capture command, only after that concrete request is authorized, is:

```sh
node packages/test-harness/editing/camera-reproduction.mjs --case shared-clock \
  --live --action capture --request /tmp/screenrec-20e-live-request.json \
  --app /tmp/screenrec-20e-reviewed-app/ScreenRecorder.app/Contents/MacOS/ScreenRecorder
```

That request file has deliberately not been created with guessed IDs. Capture
refuses missing grants and never prompts or falls back to another device. Later
physical interruption/permission cases remain parent20 work; the offline proof
neither runs nor waives them.
