The source video has four measured scene changes, in source time:

- 0.400 s (source sample ordinal 1)
- 0.800 s (ordinal 3)
- 1.800 s (ordinal 4)
- 2.200 s (ordinal 6)

The source timeline contains picture from 0–1.000 s and 1.500–2.500 s. The 1.000–1.500 s interval is a physical missing-video range in the admitted source stream.

The inspected project revision is `5fd869aa-d543-418c-b60c-4a6034945aa7`, with duration 6.750 s. It contains two occurrences of this source. The first occurrence is placed at 0–2.500 s and presents the four scene changes at 0.400, 0.800, 1.800, and 2.200 s. The second is placed at 3.000–6.750 s at 1.5x project-time scale; its scene changes appear at 3.600, 4.200, 5.700, and 6.300 s. Each project timestamp comes directly from the CLI's `projectAtUs` value.

The physical source gap appears as missing video at project times 1.000–1.500 s in the first occurrence and 4.500–5.250 s in the second. There is also a 2.500–3.000 s interval between the two placed project occurrences with no clip coverage.

These results establish that the media stream has two intervals with no available picture and that the project has an unoccupied half-second between its two clip occurrences. They do not establish why either absence exists. Capture pause, geometry, and interruption coverage are unavailable because capture context is missing. The timeline reports authored `cut` evidence as unsupported. Therefore the source gap cannot be attributed to a capture interruption, and the project gap can be described as a placement gap but not labeled as a specific authored cut operation. Scene changes are measured source observations, not evidence of edits.

Evidence files saved here include the CLI help, project and asset reads, source and project timeline reads, and scene/project-evidence job receipts. The source scene preparation initially returned canceled; its advertised job retry completed successfully, after which the source and project timeline reads became ready. No edit, export, capture, playback, or source-file change was performed.
