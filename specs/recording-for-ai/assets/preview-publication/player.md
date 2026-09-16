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
model's availability. These checks do not claim a real status-menu click, bundled
service receipt integration, visual fidelity or adjacent-speech audition; those
remain the parent integration gates. [Host verification](player-verification.json)
records the exact owner/test hashes and terminal results.
