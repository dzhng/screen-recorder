# Controlled revision review evidence

The public socket fixture creates a one-second silence composition, splits it
continuously, then explicitly moves the second segment from 500000 to 600000 us.
The retained [bundle](public-review.json) comes from the consumer helper using
production request admission and local service operations. It retains revision
history around the read, requested inspection windows, canonical cuts and missing
native audio diagnostics. Original user media and libraries are not involved.

The [control](control.png) and [candidate](candidate.png) show the same caller
selection, 400000–800000 us, using the shared timeline sheet renderer. The
control has no canonical cut; the candidate marks the exit at 500000 and entrance
at 600000 us. The candidate's extra event rows increase sheet height; both captures
use 1200×553, DPR 1. SVG originals and exact receipts are retained beside them.
Pictures were explicitly unselected. Audio rendering is deliberately unavailable
in this fixture, transcript preparation is disabled, and nobody listened.
This proves bounded review selection and factual availability, not native sound,
continuous picture or whole-revision output equivalence.

Fresh visual critique and the actual comparison verdict are recorded in the
owning slice after inspection. Capture uses headless Chrome with a scratch profile;
no focused window, user state or audio playback is involved.

Fresh critique found an event label overlapping its own marker when a full track
ID forced its placement left. The retained rejected `candidate-before-label`
image exposes it. Display IDs now abbreviate; SVG glyph extents fit strictly on
one side of each marker while exact IDs remain in receipts. Pixel differences
were confined to event labels; axis, pictures, waveform and footer were identical.
A second fresh critique accepted that fix but found the blank Pictures region
ambiguous. The retained `candidate-before-picture-status` exposes that omission.
The panel now explicitly says unselected/no frame requests; the manifest retains
the request count, and actual queued/failed frame cards keep their own states.
That change touched only the status text rectangle. Comparison JSON and lossless
pixel differences retain both controlled comparisons. The expanded event crop
keeps full marker margins. The third unprimed critique accepted this sparse sheet with clear states and no
collisions/clipping. Crowded/right-edge real scenes and smaller captures remain
unverified. Axis/event separation is a nonblocking limitation because timestamps
remain local. Its capture finding was corrected: control's 493-pixel SVG is 60
pixels shorter than candidate's 553-pixel SVG. The common dark page background
fills only control's unused margin. `background-comparison.json` proves rows
0–492 unchanged and differences exactly in the 1200×60 margin; the original full
white-margin capture is retained as `control-before-background.png`.
