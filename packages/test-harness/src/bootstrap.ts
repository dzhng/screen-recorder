import { deepStrictEqual, equal } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseRequest } from "@yap/protocol";

const root = new URL("../../../", import.meta.url);
const fixtures = JSON.parse(
  await readFile(new URL("packages/protocol/fixtures/native-requests.json", root), "utf8"),
) as Array<{
  name: string;
  line: string;
  expected: { id: string | null; ok: boolean; data?: unknown; code?: string };
}>;
const ping = fixtures[0];
if (!ping) throw new Error("Missing native ping conformance fixture");
parseRequest(JSON.parse(ping.line));
const binary = fileURLToPath(
  new URL("dist/Yap.app/Contents/MacOS/yap-native", root),
);
const result = spawnSync(binary, [], {
  input: fixtures.map((fixture) => fixture.line).join("\n") + "\n",
  encoding: "utf8",
  timeout: 5_000,
  maxBuffer: 1024 * 1024,
});
if (result.error) throw result.error;
equal(result.status, 0, result.stderr);
const lines = result.stdout.trim().split("\n");
equal(lines.length, fixtures.length, "One response per input, without diagnostics on stdout");
for (const [index, fixture] of fixtures.entries()) {
  const response = JSON.parse(lines[index] ?? "");
  equal(response.id, fixture.expected.id, fixture.name);
  equal(response.ok, fixture.expected.ok, fixture.name);
  if (fixture.expected.ok) deepStrictEqual(response.data, fixture.expected.data, fixture.name);
  else equal(response.error.code, fixture.expected.code, fixture.name);
}
process.stdout.write(
  JSON.stringify(
    { ok: true, nativeBinary: binary, cases: fixtures.map((fixture) => fixture.name) },
    null,
    2,
  ) + "\n",
);
