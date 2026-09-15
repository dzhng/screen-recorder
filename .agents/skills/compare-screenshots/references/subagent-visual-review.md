# Subagent Visual Review

Use this when history or prior conclusions could bias the main agent's visual
judgment.

## Spawn Config

- `agent_type`: `default`
- `fork_context`: `false`
- Attach the two screenshots as `local_image` items.
- Label images neutrally: `Image A`, `Image B`, or `Reference`, `Candidate`.
- Do not tell the subagent which image is candidate, reference, expected,
  accepted, failed, better, worse, new, or old.

## Prompt

```text
You are doing an unbiased visual review of two screenshots for the same visual target. You have no prior context.

Compare Image A and Image B. Report:

1. Whether they appear to show the same viewport/state/content.
2. Major visible differences in camera/view, layout, content, missing details,
   labels/text, icons, color, lighting, depth/layering, clipping, artifacts,
   readability, or style.
3. Which image is more complete/readable for the apparent task and why.
4. A concise verdict on whether the images preserve the intended visual
   relationship or need another pass.

Do not assume either image is the desired target; judge only from visible pixels.
```

## How To Use The Result

- Treat the subagent result as independent evidence about which image is less
  wrong, not a replacement for metrics or your own inspection — and not a vote
  for whichever image is the baseline.
- If the subagent flags wrong camera, mismatched state, missing content, or
  visible artifacts, fix capture/rendering quality before judging the rest.
- Quote the subagent verdict in the working notes when it changes or confirms
  the next implementation target.
