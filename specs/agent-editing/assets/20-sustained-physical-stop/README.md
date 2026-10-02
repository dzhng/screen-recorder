# Sustained physical Stop

Status: failed the unchanged ten-second deadline. One explicit public capture
used the signed staged candidate, a fresh isolated library, built-in camera,
built-in microphone and display. More than 200 seconds of active source media
and one pause/resume distinguish this from the accepted brief capture.

Stop acknowledged finalizing; physical inputs later closed and the camera
published, while primary screen/microphone publication remained pending at the
deadline. Cleanup subsequently left both sources complete with no dropped media
samples and a clean app/service exit. That cleanup cannot retroactively pass the
deadline. The prior socket-path setup failure happened before capture and remains
separate from this one physical attempt.

[Verification](verification.json) binds the exact candidate, public observations,
complete private report, source/media pins and [curated evidence](evidence.tar.xz).
Raw media, window inventory and cursor positions remain private. File mtimes and
poll timing lower bounds locate pending publication; they are not decoder-stage
measurements or proof that quitting changed scheduling. Before-stop internal
verification counts were not retained and cannot be invented from the final
picture count.

The existing native lifecycle publishes camera and primary sources sequentially
after closure. The next correction evaluates independent source publication
through that owner, retaining each source's full validation, cancellation, retry,
recovery and journal lifetime. It does not parallelize primary audio roles or
raise the deadline. A focused regression and preserved output/recovery behavior
must precede a changed-candidate physical confirmation. No unchanged recapture
is queued. This test establishes no iPhone synchronization, physical event onset,
perceptual quality or installed release acceptance.
