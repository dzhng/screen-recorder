# Native gesture probe: gate remains open

The bundled app exposed its own fixture window to native UI automation. Screenshot
and accessibility access worked. Eight drag segments attempted a circle in B2 and
five attempted a wave in B3 while that window alone was recorded with microphone
and system audio disabled. Capture stopped normally after 29.72 seconds.

The [summary](summary.json) records 1,783 actual cursor observations, all outside
the window. There is no observed inside circle or wave. A public annotated frame
therefore correctly reports the outside cutoff, no pointer and zero trail points;
the [delivered image](delivered.png) shows the captured fixture without invented
pointing. The source media/journal hashes are retained in the summary.

UI action completion is not evidence that the native cursor sampler saw the
intended path. This probe does not distinguish background UI event behavior from
cursor-coordinate/acquisition issues, so it does not justify changing the mapping
or claiming either defect fixed. Keep physical circle/wave acceptance open until
an independently observed inside pointer path can be compared with source pixels.

The app and owned service were stopped successfully. The original probe recording
remains under /tmp/screenrec-real-gesture-6DQmnG for local follow-up. Raw global
pointer coordinates are not copied into this report because they do not establish
the intended fixture gesture.
