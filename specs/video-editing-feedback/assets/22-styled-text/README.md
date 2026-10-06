# Styled text layout evidence

Slice22A retains the native `YapFrameTests --text-vertical` checkpoint. It exercises
real CoreText Arial glyphs for omitted/top, center, bottom, clipping and empty text.
The first independent review found that empty text needed an explicit zero-bounds
receipt; that correction is in the shipped checkpoint and the focused test is green.
Decoration and public caption-sheet evidence remain open for22B.
