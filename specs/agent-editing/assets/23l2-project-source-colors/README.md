# Canonical video source colors before PNG composition

Available decoded video enters the PNG graph as the same rendered source picture
delivered by the raw frame owner. FrameImage owns that color conversion; all graph
geometry and composition still run. ImageIO, glyph and unavailable surfaces keep
their existing preparation. The movie graph and Rec.709 terminal are unchanged.

The source raster is transient and original-size, bounded by existing per-video
source-pixel reservations. This adds no retained graph/cache, public parameter or
refusal policy. It does not bypass identity graphs or special-case source files.

[Verification](verification.json) distinguishes the original-video red and its
complete-pixel green from the small still-image controls, which were already green
before the correction. It points to the one-buffer stage diagnostic and rejected
precision-only remedy. Executed commands/terminals and exact request/reply bytes
are retained here. Full images, superseded broad candidate and routine compile
setup failures remain in the named scratch authorities. Remaining composition
requests and native transport are separate qualification work. Movie controls do
not establish full pixel parity.
