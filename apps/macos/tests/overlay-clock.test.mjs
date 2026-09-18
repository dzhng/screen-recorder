import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { controlsProbe, launchReady, setDefault, temporary, waitFor } from "./harness.mjs";

const title = "Screen Recorder Controls";

// A take that passes an hour spends a character more on its clock. The controls must widen for it:
// a panel that keeps its old width wraps its own buttons onto a second line.
test("the floating controls widen for a clock past an hour", { timeout: 90_000 }, async () => {
  const home = temporary("/tmp/scr-overlay-clock-");
  const domain = join(home, "scratch-preferences");
  setDefault(domain, "showSettingsAtLaunch", "-bool", "NO");
  const commands = join(home, "controls");
  mkdirSync(commands, { recursive: true });
  const { instance } = await launchReady(home, {
    SCREENREC_DEFAULTS: domain,
    SCREENREC_FIXTURE_CONTROLS: commands,
  });
  try {
    await instance.waitFor(/controls probe listening/);
    const send = controlsProbe(commands);
    const controls = async () =>
      (await send({ do: "windows" })).windows.find((window) => window.title === title);

    const shown = async (elapsed) => {
      assert.equal((await send({ do: "overlay", elapsed })).ok, true);
      return waitFor(async () => (await controls()) ?? false, 20_000);
    };
    // The row reserves an hours field from the first second, so the take that reaches one changes
    // nothing about the shape a person has been looking at.
    const short = await shown("0:02");
    for (const elapsed of ["59:59", "1:00:00", "2:00:00", "10:02:03"]) {
      const row = await shown(elapsed);
      assert.deepEqual(
        [row.width, row.height],
        [short.width, short.height],
        `${elapsed} changed the controls from ${short.width}×${short.height}`,
      );
    }
  } finally {
    instance.kill("SIGTERM");
    await instance.exited;
  }
});
