import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { out: { type: "string" }, font: { type: "string" } } });
assert(values.out && values.font, "Pass --out fresh-directory --font exact-font-file");
const out = resolve(values.out);
await mkdir(out);
const source = join(dirname(fileURLToPath(import.meta.url)), "text-layout.swift");
const executable = join(out, "text-layout");
execFileSync("swiftc", [source, "-o", executable], { timeout: 60_000 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base = {
  text: "Hello, world!\nCaption two.",
  fontPath: resolve(values.font),
  fontSHA256: hash(await readFile(values.font)),
  size: 32,
  width: 420,
  height: 100,
  alignment: "left",
  wrap: true,
  rgba: [1, 1, 1, 1],
};
const report = {
  sourceSHA256: hash(await readFile(source)),
  fontSHA256: base.fontSHA256,
  publicCaptionsReady: false,
  cases: [],
  checks: [],
};
async function render(name, overrides = {}, refusal) {
  const request = { ...base, ...overrides };
  const input = join(out, `${name}.json`);
  const png = join(out, `${name}.png`);
  await writeFile(input, JSON.stringify(request, null, 2));
  const result = spawnSync(executable, [input, png], { encoding: "utf8", timeout: 10_000 });
  if (refusal) {
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, refusal);
    await assert.rejects(stat(png), { code: "ENOENT" });
    report.cases.push({ name, request, error: result.stderr.trim() });
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.pngSHA256, hash(await readFile(png)));
  report.cases.push({ name, request, receipt });
  return receipt;
}
const first = await render("punctuation-newline");
assert.deepEqual(
  first.lines.map((line) => line.text),
  ["Hello, world!\n", "Caption two."],
);
assert.deepEqual(first.visibleRange, [0, base.text.length]);
assert.deepEqual(
  first.lines.map((line) => line.origin[0]),
  [0, 0],
);
const repeated = await render("repeat");
assert.equal(first.pngSHA256, repeated.pngSHA256);
report.checks.push("literal punctuation/newline preserved; identical request has identical PNG");
for (const alignment of ["center", "right"]) {
  const receipt = await render(alignment, { alignment });
  assert.notEqual(receipt.pngSHA256, first.pngSHA256);
  for (const line of receipt.lines) {
    const expected = (base.width - line.width) / (alignment === "center" ? 2 : 1);
    assert.equal(line.origin[0], expected);
  }
}
report.checks.push("center/right placement matches requested alignment");
const longText = "Supercalifragilisticexpialidocious ends here.";
const wrapped = await render("long-word", { text: longText, width: 180, height: 360 });
assert.equal(wrapped.lines.map((line) => line.text).join(""), longText);
assert(wrapped.lines.length > 2);
assert(wrapped.lines.every((line) => line.width <= 180));
report.checks.push("long word wraps without losing literal text");
const clipped = await render("height-clipped", { height: 40 });
assert.equal(clipped.lines.length, 1);
assert.equal(clipped.lines[0].text, first.lines[0].text);
assert.equal(clipped.visibleRange[1], first.lines[0].range[1]);
const noWrap = await render("width-clipped", { text: longText, width: 180, wrap: false });
assert.equal(noWrap.lines.length, 1);
assert.equal(noWrap.lines[0].text, longText);
assert(noWrap.lines[0].width > 180);
report.checks.push("requested horizontal clipping and vertical overflow remain measurable");
await render("font-changed", { fontSHA256: "0".repeat(64) }, /FONT_CHANGED/);
await render("font-missing", { fontPath: join(out, "absent.ttf") }, /doesn’t exist|No such file/);
await render("fallback-refused", { text: "Caption 中文" }, /FONT_SUBSTITUTED/);
report.checks.push("changed/missing font and ambient fallback refused before image publication");
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ checks: report.checks, out }, null, 2));
