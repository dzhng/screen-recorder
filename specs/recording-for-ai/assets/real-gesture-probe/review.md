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


## Focused-window follow-up

Native Preview navigation required explicitly raising its window. Two new owned
capture probes tested whether this explained the earlier gesture failure: first
raising before recording, then raising and performing every circle/wave segment in
one computer-use call. Both captured only the fixture window with microphone/system
audio disabled. They still recorded zero inside samples (2,536 and 1,865 outside).
The [summary](focused/summary.json) retains counts/hashes without global coordinates.

A [public image](focused/delivered.png) requested at 36 seconds selected 36.015 seconds
and correctly contained zero trail points with an outside cutoff. Original probe
media remains in its temporary recording library. Both owned app/service processes
were stopped and their execution handles reached exit 0. Focusing did not establish
captured pointing; this remains a failed automation probe, not a verified physical
cursor gate or evidence for changing coordinate transforms.
