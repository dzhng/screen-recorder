import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { controlsProbe, launchReady, temporary } from "./harness.mjs";

test("the header Library action preserves the public controls identity", async () => {
  const home = temporary("/tmp/yap-navigation-");
  const commands = join(home, "controls");
  mkdirSync(commands);
  const { instance } = await launchReady(home, { YAP_FIXTURE_CONTROLS: commands });
  try {
    const send = controlsProbe(commands);
    await send({ do: "open" });
    const opened = await send({ do: "windows" });
    assert.equal(opened.active, false, "Automated probe opens must not activate the app");
    assert.equal(opened.windows.find((window) => window.title === "Yap Capture")?.visible, true);
    const snapshot = await send({ do: "snapshot" });
    assert.equal(
      snapshot.rows.find((row) => row.identifier === "header.library")?.item,
      "app.library",
    );
    assert.equal((await send({ do: "choose", item: "app.library" })).ok, true);
    assert.equal(
      (await send({ do: "windows" })).windows.find((window) => window.title === "Library")?.visible,
      true,
    );
  } finally {
    instance.kill("SIGTERM");
    await instance.exited;
  }
});
