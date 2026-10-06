The patch passes the available TypeScript checks, but valid requests can impose excessive native work and malformed edge measurements are not fully validated before publication.

Full review comments:

- [P2] Validate aggregate region sampling work — /Users/server/dev/yap-picture-statistics/helpers/mac/Sources/YapFrames/PictureObservations.swift:172-172
  A valid request with eight regions covering an 8192×8192 raster causes the full image to be scanned once and every region to be scanned again, reaching roughly 600 million pixel iterations. Because this runs in the native worker for public frame and index requests, callers can monopolize or time out the worker with schema-valid input. Accumulate regions in one pass or cap total sampled pixels.

- [P2] Validate edge metrics against pixel evidence — /Users/server/dev/yap-picture-statistics/packages/protocol/src/picture.ts:177-181
  The receipt schema accepts arbitrary `opaqueFraction`, `darkFraction`, and `meanLuma` values for edge bands as long as they meet the threshold checks; it does not derive or otherwise verify them against the measured raster. A malformed native receipt can therefore publish false objective edge evidence. Include sufficient per-edge operands or independently validate these metrics before publication.