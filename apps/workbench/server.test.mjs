import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbenchServer } from "./server.mjs";
test("serves the fixture and keeps non-fixture files inaccessible", async () => {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Asymmetric reference grid/);
    assert.equal(
      (await fetch(`${base}/app.js`)).headers.get("content-type"),
      "text/javascript; charset=utf-8",
    );
    assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
