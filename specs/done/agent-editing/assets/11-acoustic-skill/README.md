# Blind acoustic image skill use

A fresh gpt-6-luna agent, without inherited conversation, received only the product
skill, a frozen CLI launcher, source/project IDs and this task: inspect waveform
and spectrogram images to locate a short prominent interval within 2 ms, estimate
the sustained tone in each channel within 100 Hz, map repeated project uses, and
compare first-occurrence dry/processed track peaks. JSON could supplement image
inspection. Edits, capture, playback, movie export and model preparation were excluded.

The agent located source samples 38,400–38,592 (800–804 ms) and mapped occurrences
at 800–804 ms and 2,800–2,804 ms. Its image estimates of 800 and 3,070 Hz are within
100 Hz of the authored 750 and 3,000 Hz tones. It explicitly noted the image's
approximately 133 Hz/pixel vertical resolution rather than claiming FFT-bin precision.
Dry peaks were 0.32/1.5; processed peaks 0.16/0.75, matching the track's half gain.
The waveform image localized the spike; fine buckets established its exact bounds.

Root grading checks the delivered values, preserved project revision and complete
read/discovery command trace. The retained reference WAV and revision describe the
fixture. Grade hashes pin the skill, native worker, bundled service/CLI and output
artifacts. The service exited successfully and its scratch home was removed.
The agent did not listen. This proves bounded image/measurement navigation and
processing comparison, not speech cleanup, joins, denoise or musical quality.
