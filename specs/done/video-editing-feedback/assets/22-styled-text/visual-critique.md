# Fresh visual critique

## Scope

The intended candidate is the public static sheet from
`captions.mjs --case styled-sheet`: one 640×420 frame with four caption cells.
There is no candidate PNG to inspect in this pass. The public run reached service
admission and queued `frame.get`, but the available worker returned a failed
`Malformed picture receipt`; building a matching worker was blocked by the
missing generated RNNoise source file. The native `YapFrameTests --text-vertical`
and `--text-decorations` checks did pass, but those are isolated raster checks,
not the public sheet.

## Adversarial inspection

- **Strongest case that the sheet is broken:** the four cells could overlap,
  clip their decoration, or render in the wrong order even when the receipt
  echoes the requested styles. No public PNG exists to disprove that.
- **Strongest case that the layout is readable:** each cell has an explicit
  280×150 rectangle inside the 640×420 canvas, with 20 px outer margins and
  distinct clip IDs; the helper checks decoration bounds against glyph ink.
  This is an authored geometry claim, not visual output evidence.
- **Strongest case that vertical placement is wrong:** the static assertion
  compares only receipt offsets and orders three variants; a malformed native
  receipt could never reach those assertions. The public run therefore cannot
  establish vertical placement.
- **Strongest case that styling is wrong:** receipt fields can be truthful while
  the actual stroke, shadow or rounded background is missing or composited under
  another layer. The isolated native decoration test renders pixels, but not the
  four-cell public composition.

## Verdict

Unverified. No visual acceptance claim is made. The next run must build the
matching native worker (including the generated RNNoise source), rerun the public
CLI/MCP journey, retain `styled-caption-sheet.png` and `report.json`, then run
`compare-screenshots` single-image metrics and an unprimed critique on that full
sheet plus four cell crops. Human QA is not required.
