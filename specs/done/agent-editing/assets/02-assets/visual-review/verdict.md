# Orientation and admission comparison

Target: the corpus's +90-degree display transform must produce a 96×160 image,
with the red upper-left source landmark at the displayed lower-left and the green
opposite landmark at the displayed upper-right. Admission must preserve the
same source's decoded geometry after the external file is removed.

Root inspected both complete images and commissioned the attached fresh,
unprimed critique with both images and 4× crops. Decoded RGBA comparison reports
zero differing channels and byte-identical native PNGs. This establishes admission
parity, not correctness by similarity alone. The independent corner oracle plus
visible red lower-left/green upper-right satisfies the orientation target.

The critique identifies sideways, small lettering and colored boundary fringes.
The label rotates with the source and is deliberately a low-resolution pixel
counter; neither a horizontal label nor new typography belongs to this slice.
Landmarks intentionally touch the original image edges. No displaced block or
relative orientation difference is visible. Verdict: both source and admitted
candidate satisfy this slice's orientation target; neither is less wrong than the
other.

The native red value differs from the independent FFmpeg decode. This comparison
does not accept color parity: slice 06 must investigate color interpretation on
untagged inputs. The visible fringes remain part of that render-fidelity question,
not a claimed admission fix. No whole-editor or full-render acceptance is implied.
