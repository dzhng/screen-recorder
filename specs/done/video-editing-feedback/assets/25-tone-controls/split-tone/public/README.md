# Public split-tone delivery

This receipt runs the caller-facing CLI and MCP path with the retained 33³
immutable LUT. It generates the frozen independent chart, imports that image and
`split.cube` through `asset.import`, places the chart in a scratch project, and
applies the LUT through `processing.set` before reading the delivered frame.

The independent linear-sRGB curve is evaluated directly in the harness and agrees
with the native delivered raster at mean error `0.0203` and maximum one code value
across all 172,800 RGB bytes. The report retains three masks: the grayscale
neutral strip, the dark shadow-color quadrant and the bright highlight-neutral
quadrant. Each mask has its own before/expected/candidate means and comparison.

The run uses a disposable managed state and preserves the frozen LUT/source
inputs. `split-tone-public.mjs` is the executable journey; `report.json` is the
captured public exchange receipt.
