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

A subsequent read of the same hash-verified journals distinguishes the failed
attempts: the first has 1,062 distinct global positions and button states 0/1,
all outside the captured bounds; the second has exactly one global position and
no button-down sample. Thus the second automation sequence did not produce an
observed drag, even though its UI actions returned. These counts narrow the next
probe: independently verify actual pointer movement over the fixture before using
its recording to judge the geometry transform. They do not identify which control
or coordinate layer caused the first path to remain outside.


## Coordinate diagnostic

A [read-only normalized-coordinate check](coordinate-diagnostic.json) verified the
first probe's journal hash before analysis. Every recorded global X lay outside the
frame's reported screen rectangle: approximately 2.64–4.26 rectangle widths from
its left edge, where inside would be 0–1. Changing only the vertical flip therefore
cannot explain this failure. This does not identify whether UI event coordinates,
source selection or acquisition metadata caused the displacement. The next live
probe needs an independent pointer/window coordinate witness before changing any
production transform. No additional capture was made and no global positions are
published here.

## Independent live pointer witness

A [new read-only witness](pointer-witness.json) compared `CGEvent.location` with
`NSEvent.mouseLocation` converted to the same screen coordinate system. Both were
normalized against the owned fixture's independently queried window bounds. No
recording, audio access or production change was involved.

During four UI drag calls, all 1,800 samples reported one unchanged position outside
the fixture; the two APIs agreed. A second drag pair was bracketed by explicit UTC
observations inside the sampler's 45-second run. The fixture was 800 by 532 points;
the commanded drag coordinates were inside it. A preceding click also left the
observed system pointer unchanged. Sampling continued through the action window.

This establishes that these native UI automation calls supplied no observable global
pointer path in this probe. It does not prove the automation backend's internals,
exclude movements shorter than the sampling interval, or establish physical gesture
accuracy. Keep the placement/circle/wave gate open; changing the production transform
would not address the measured lack of movement. The raw normalized series and
read-only witness remain under `/tmp/screenrec-pointer-*`; the receipt records its
hash without publishing global pointer coordinates.

The UI close action timed out. The exact owned fixture process was then verified and
terminated; both the fixture and sampler handles reached exit zero. No owned service
or capture session was created.
