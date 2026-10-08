# Capability catalog

The public CLI and optional MCP adapter expose the same operation catalog. The
protocol declaration is the source of schemas and help; inspect an installed
build before sending a request:

```sh
yap --help
yap <operation> --help
```

The catalog is grouped by the contract it owns. A name below is an advertised
operation, not permission to infer parameters or readiness. Use its current
help schema and preserve the returned JSON envelope.

## Projects, edits and revisions

`project.create`, `project.delete`, `project.get`, `project.list`,
`edit.apply`, `edit.undo`, `edit.restore`, `revision.get`, `revision.history`,
`text.seed`, `processing.get`, `output.capabilities`, and
`processing.capabilities` create, inspect and revise non-destructive projects.

## Inputs, assets and storage

`acquisition.import`, `acquisition.get`, `asset.import`, `asset.convert`,
`asset.get`, `asset.segments`, `asset.origins`, `asset.list`, `recording.get`,
`recording.latest`, `recording.list`, `recording.delete`,
`recording.cleanup`, and `storage.usage` discover admitted media, retain
source identities, and reclaim only verified working files.

## Packages and jobs

`package.open`, `package.status`, `package.adopt`, `package.close` manage
editable package lifetimes. `job.get`, `job.retry`, and `job.cancel` observe or
explicitly recover/cancel admitted background work. A read never retries a
failed job implicitly.

## Export and delivery

`export.create`, `export.list`, `export.status`, `export.retry`,
`export.recover`, `export.cancel`, and `export.abandon` publish or recover
video, audio, captions, and editable packages. `artifact.read`,
`artifact.renew`, and `artifact.close` consume large CLI/MCP deliveries.

## Evidence and indexing

`index.get`, `index.retry`, `index.coverage`, `index.frame`, `index.frames`,
`face.trajectory.get`, `correspondence.prepare`, `correspondence.get`,
`alignment.prepare`, `alignment.get`, `cursor.render`, `cursor.render.retry`,
`speaker.continuity.prepare`,
`speaker.continuity.get`, `speaker.prepare`, `speaker.get`, `speaker.bind`,
`join.verify`, `timeline.events`, and `cursor.raw` expose measured visual,
audio, timing, face, speaker, alignment and join evidence. Evidence is
information; it never authorizes an edit.

## Transcript, audio and visual processing

`transcript.review`, `transcript.render.prepare`, `transcript.render.retry`,
`transcript.render.get`, `transcript.prepare`, `transcript.get`,
`transcript.search`, and `transcript.retry` provide source/project text and
rendered speech evidence. `audio.extract`, `audio.prepare`, `audio.get`,
`audio.measure`, and `audio.retry` provide retained or measured PCM.
`waveform.get`, `waveform.retry`, `spectrogram.get`, and `spectrogram.retry`
provide bounded signal views. `frame.get`, `frame.batch`, and `frame.retry`
provide stills; `preview.get` and `preview.retry` provide playable previews.
`voice.generate` creates a durable generated audio asset from an explicit
reference and text.

## Models and runtime

`model.list`, `model.status`, and `model.prepare` discover, inspect and prepare
registered local models. `service.health` reports readiness without starting a
capture; `service.tools` reports the selected app's verified Node and media
tools.

## Capture

`capture.sources`, `capture.start`, `capture.status`, `capture.pause`,
`capture.resume`, `capture.stop`, `capture.cancel`, and `capture.restart`
control explicit screen/audio/camera acquisition. `recording.*` operations
remain the owner of retained recording discovery and cleanup.

## App updates and Yap skill lifecycle

`update.status`, `update.check`, and `update.setEnabled` expose the native app
updater. `skill.status`, `skill.install`, `skill.uninstall`, and `skill.update`
expose the global Yap consumer-skill lifecycle. When skill maintenance is
enabled, install/update stages a complete pinned folder and lets `npx skills`
discover supported harnesses (including Codex and Claude), replacing any
existing global Yap skill. Disable maintenance before customizing the global
skill; uninstall removes only the installation managed by Yap.

The skill operations return a status snapshot after mutation. Settings shows a
compact state; the CLI remains the diagnostic surface for paths, source
revision, discovery links, ownership and errors. Lifecycle reconciliation runs
at app launch, after an app update, when maintenance is re-enabled, and on an
explicit `skill.update`; it does not use a periodic timer.

If an installed build does not advertise a name above, report the mismatch and
follow the available schema. Do not invent an operation or silently substitute
a different mutation.
