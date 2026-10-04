# Native playback ownership

The native menu opens one pinned preview in `PreviewController`. The initial
`preview.get` resolves the revision; later preparation reads and explicit retries
name that same revision. Closing the view stops observing preparation, without
canceling a shared render job that another client may need.

The player reads the service's private immutable cache file while its delivery
lease remains valid. Renewal extends the existing pin; it creates neither another
movie copy nor another storage owner. Cache filenames do not identify the media
container, so the player supplies the validated `video/mp4` MIME type through
`AVURLAssetOverrideMIMETypeKey`. A real extensionless generated MP4 failed native
playback without that hint and became playable with it.

The existing controls cadence observes recording deletion and enforces expiry,
including while paused or a service call is outstanding. Close, replacement,
service loss, expiry, renewal failure and SDK playback failure detach the player
before releasing the token. Late ready replies release their token without
reopening a window. Own-menu deletion closes the matching view before dispatch;
external deletion closes it on the next completed library observation. This is
client observation, not a synchronous cross-process revocation of already-decoded
pixels. AVKit paused-frame object/text analysis is disabled: this product presents
recorded evidence without interpreting it. A killed app stops renewing and the service's finite lease expires.

`apps/macos/tests/preview-player.test.mjs` compiles the actual owner and uses a
real AVPlayer with generated silent H.264 media. Its service boundary is scripted
so delayed receipts, expiry and deletion are controlled. It checks native decoder
readiness and duration, pinned identity, renewal past the first deadline, failed
playback and view cleanup. The ordinary controls tests cover the actual menu
model's availability. These controlled-boundary checks do not claim a real status-menu click, visual
fidelity or adjacent-speech audition; those remain parent integration gates. [Host verification](player-verification.json)
records the exact owner/test hashes and terminal results.


## Actual bundled service integration

The [real-service test](player-service-tests.txt) compiles the production player,
ServiceHost, bundle resolver and Node resolver, then starts the actual bundled
service and native worker. The generated silent browser fixture opens as an
eight-second native preview. A concurrent public cut changes the library revision
to six seconds; the existing AVPlayer item stays pinned to the original. Paused
playback remains valid beyond the initial thirty-second delivery expiry through
real renewal calls. The original source hash stays unchanged. Public deletion
then removes the cache file and the next observation detaches the player.
The owned service exits before its temporary home is removed.

[Mutation evidence](player-service-mutation.txt) omits only the service timer
refresh: the receipt still claims a longer expiry, but the player loses the cache
pin at the old deadline and the test fails. Restoring the owner returns green.
The first integration attempt also exposed a test adapter mismatch: it threw the
raw Swift failure while the production controls format its code/message. The test
now uses that same boundary presentation; no product behavior changed for it.

Independent review found no actionable test defect. Its execution was blocked by
sandbox Unix-socket permissions, so host results above are the runtime evidence.
This is real native/service playback integration, not a physical status-menu click
or a screenshot-based visual acceptance result.


## Cocoa event loop and bounded live inspection

The integration harness runs the normal Cocoa application event loop and schedules
its asynchronous driver on the main actor. This lets the same production player
participate in native application discovery, rather than merely decoding media in
an asynchronous command-line process. The [host rerun](player-cocoa-tests.txt)
passes the existing pinned edit, renewal and deletion assertions unchanged.

A temporary app wrapper using these production owners was inspected live with CUA.
An independent unprimed reviewer saw the complete browser fixture with no blank
pane, clipping or overlap. Main headings, prices and the action were readable;
small raster text appeared soft. Source-font and playback-scaling contributions
were not isolated. Playback controls and a cursor were absent in that chosen frame.
No screenshot file was retained, so this observation does not close the screenshot
acceptance gate, physical menu interaction or control/seek verification. The owned
review app and its service terminated after the probe.
