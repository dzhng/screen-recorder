# Scene and missing-video inspection

Target: asset `491d34c0c2bff15f01d8be032bafa4ca1a96f6244ddc4ba2738bf7673678b49e`, video stream `track:1`, in project `d0abe4bd-5a98-49f7-a1d7-ca90910b2685`, revision `2ace913f-ff0b-438f-a6b8-b95486abd5be`.

The source-scene read completed with scene evidence generation `aaf90c5c-04ad-4954-a377-085fed69bc39` using `rgb-spatial-change-v2-presentation-v1`. All measured source changes appear in the edited project on clip `clip:f5da1d9d3edea1de7ae4435a312c93e65734e85fbc947ba3d40c6314e5173ae1:1` and track `track:f5da1d9d3edea1de7ae4435a312c93e65734e85fbc947ba3d40c6314e5173ae1:0`:

| Scene ordinal | Source time | Project time |
|---:|---:|---:|
| 1 | 0.400000 s | 0.400000 s |
| 3 | 0.800000 s | 0.800000 s |
| 4 | 1.800000 s | 1.800000 s |
| 6 | 2.200000 s | 2.200000 s |

All values are exact microsecond timestamps from the CLI receipts (400000, 800000, 1800000, and 2200000 µs); project mapping is explicitly reported as `projectAtUs` and matches source time for this occurrence.

The source stream and project occurrence report video support on `[0, 1.0 s)` and `[1.5 s, 2.5 s)`. The missing-video interval is `[1.0 s, 1.5 s)` (1,000,000–1,500,000 µs). The project coverage receipt independently reports this same unavailable interval. Asset metadata also lists an empty segment from -0.25 s to 0, outside the selected stream's nominal `[0, 2.5 s)` range; it is not part of the project occurrence's missing interval.

Evidence limits: capture pause, geometry, and interruption coverage are unavailable because capture context is missing (`capture_context_missing`). Therefore the media gap establishes absent video support in the asset/project, but cannot establish that capture was interrupted or why video is missing. Project-cut coverage is explicitly unavailable as `unsupported`, so these reads cannot determine whether an authored cut caused the gap. Scene rows are measured source changes; their presence at matching project times does not establish authored cuts. The project occurrence itself spans 0–2.5 s and reports the hole as unavailable support.

Receipts: `asset.json`, `project.json`, `source-events-2.json`, `project-events-2.json`, `scene-job-2.json`, and `scene-retry.json`. The first scene request was canceled; the job was explicitly retried and reached ready. The project query was repeated with the same pinned project revision/range after its initial processing response and reached ready. `help.json` preserves the CLI registry and schemas.
