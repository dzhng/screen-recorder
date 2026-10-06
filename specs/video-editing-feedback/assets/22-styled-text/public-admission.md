# Public styled-caption admission

The public command was attempted with the available native worker:

```sh
YAP_NATIVE=<matching-yap-native> \
  node packages/test-harness/editing/captions.mjs \
  --case styled-sheet --out <new-directory>
```

Service startup, CLI/MCP setup, project creation, edit admission and `frame.get`
job submission all completed. The job settled failed with `Malformed picture
receipt`, before the helper could inspect a PNG or receipt rows. The existing
native checks passed independently:

```sh
YapFrameTests --text-vertical
YapFrameTests --text-decorations
```

A matching `yap-native` rebuild was attempted but stopped because the checkout
lacks `helpers/.build/rnnoise/rnnoise_data.c`. This is an environment/build
blocker, not evidence that the public styled-caption contract is correct. The
public static-sheet gate remains open until a matching worker produces the
retained PNG and receipt.
