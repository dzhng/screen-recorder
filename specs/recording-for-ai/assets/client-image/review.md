# Actual-agent image access

Target: two distinct generated six-digit images must be legible to a real agent,
with digits absent from prompts, filenames, and tool metadata.

Claude Code 2.1.265 read both correctly through the MCP image tool and through Read
on CLI-produced files. The exchanges retain actual tool calls and image results;
[verification.json](verification.json) compares both answers with the generated
expectation. [delivery-integrity.json](delivery-integrity.json) confirms the image
bytes delivered in both traces match the two retained source PNGs exactly.

The compare-screenshots single-image pass measured opaque 720×200 frames, full
255 luminance contrast, and edge densities 0.05169/0.04813. Dominant white background
is intentional for this reading test, not evidence of missing content. The shared
skill used the already-installed image dependencies in the game workspace; no
product image-comparison dependency was added.

After integrity/metrics checks, a fresh unprimed reviewer read 439416 and 547844
from the full tight image set and found no clipping, contrast, legibility or
artifact defects. Root inspection agrees. These are test images, not a product
visual-design approval or proof that recorded UI text is always readable.

Independent Codex review found no actionable code defects; type checking, lint and
diff checks passed. Root ran the actual networked image probe. The initial harness
CLI invocation failed because variadic tool flags consumed the positional prompt;
the explicit argument delimiter and closed stdin resolved it before passing runs.
