import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { controlsProbe, launchReady, setDefault, temporary, waitFor } from "./harness.mjs";

/**
 * Writes the review copies of the Settings window, into
 * `specs/done/recording-for-ai/assets/settings-window` unless `SHOTS` names somewhere else.
 *
 *     node apps/macos/tests/settings-shots.mjs
 *
 * Each picture is the window's own drawing, so nothing is photographed off the screen: the launch
 * never activates this app and orders the window in behind whatever the person at the Mac is
 * doing. Five of the six state their access through `SCREENREC_FIXTURE_PERMISSIONS`, which
 * replaces what the window displays and nothing else — changing this Mac's own record of what the
 * app may do is not something a check may do for a screenshot.
 */
const out =
  process.env.SHOTS ??
  join(import.meta.dirname, "../../../specs/done/recording-for-ai/assets/settings-window");
mkdirSync(out, { recursive: true });
const title = "Screen Recorder Settings";

/** Every capture this run writes: what it is called, how it looks, and what access it shows. */
const shots = [
  { name: "light-not-allowed", appearance: "light", permissions: "undetermined" },
  { name: "light-allowed", appearance: "light", permissions: "granted" },
  { name: "light-denied", appearance: "light", permissions: "denied" },
  { name: "dark-not-allowed", appearance: "dark", permissions: "undetermined" },
  { name: "dark-allowed", appearance: "dark", permissions: "granted" },
  // The one that shows what macOS has actually recorded for this build.
  { name: "dark-real-permissions", appearance: "dark", permissions: undefined },
];

for (const shot of shots) {
  const home = temporary("/tmp/scr-settings-shots-");
  const domain = join(home, "scratch-preferences");
  // The window is opened through the menu, so this run decides when it appears rather than the
  // launch preference deciding for it.
  setDefault(domain, "showSettingsAtLaunch", "-bool", "NO");
  const commands = join(home, "controls");
  mkdirSync(commands, { recursive: true });
  const { instance } = await launchReady(home, {
    SCREENREC_DEFAULTS: domain,
    SCREENREC_FIXTURE_CONTROLS: commands,
    ...(shot.permissions ? { SCREENREC_FIXTURE_PERMISSIONS: shot.permissions } : {}),
  });
  await instance.waitFor(/controls probe listening/);
  const send = controlsProbe(commands);
  await send({ do: "appearance", value: shot.appearance });
  await send({ do: "open" });
  await send({ do: "choose", item: "app.settings" });
  await waitFor(
    async () =>
      (await send({ do: "windows" })).windows.some(
        (window) => window.title === title && window.visible,
      ),
    20_000,
  );
  // The form lays itself out and the access rows read their state once the window is up.
  await delay(600);
  const path = join(out, `${shot.name}.png`);
  const written = await send({ do: "shot", window: title, path });
  if (!written.ok) throw new Error(`${shot.name}: ${written.error}`);
  console.log(`${path} ${written.width}×${written.height}`);
  instance.kill("SIGTERM");
  await instance.exited;
}
process.exit(0);
