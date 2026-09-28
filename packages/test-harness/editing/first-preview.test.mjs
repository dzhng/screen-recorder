import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTone, assertImpulse, rmsDifference } from "./preview-audio-evidence.mjs";
const tone = (gain = 1, hz = 440) =>
  Float32Array.from(
    { length: 48000 },
    (_, i) => ((gain * 4000) / 32768) * Math.sin((2 * Math.PI * hz * i) / 48000),
  );
test("AAC gain oracle rejects hidden mix attenuation, wrong source and silence", () => {
  assertTone(tone(), 440, 4000 / 32768);
  for (const wrong of [tone(0.5), tone(0), tone(1, 880)])
    assert.throws(() => assertTone(wrong, 440, 4000 / 32768));
  assert.ok(rmsDifference(tone(), tone(0.5)) > 0.04);
});
test("impulse oracle rejects shifted or missing retained transients", () => {
  const samples = new Float32Array(48000);
  samples[24000] = 0.8;
  assertImpulse(samples, 24000);
  assert.throws(() => assertImpulse(samples, 24020));
  assert.throws(() => assertImpulse(new Float32Array(48000), 24000));
});

test("replacement oracle refuses old-source audio mixed under the new source", () => {
  const a = tone(),
    b = tone(1, 880);
  const mixed = Float32Array.from(a, (value, i) => value + b[i]);
  assertTone(mixed, 880, 4000 / 32768); // Presence alone cannot establish replacement.
  assert.throws(() => assertTone(mixed, 440, 0));
  assertTone(b, 440, 0);
});
test("stereo oracle rejects silent, attenuated and shifted right channels", async () => {
  const { duplicatedMono } = await import("./preview-audio-evidence.mjs");
  const a = tone();
  duplicatedMono(Float32Array.from(Array.from(a).flatMap((value) => [value, value])));
  for (const right of [
    new Float32Array(a.length),
    tone(0.5),
    Float32Array.from(a, (_, i) => a[(i + 1) % a.length]),
  ])
    assert.throws(() =>
      duplicatedMono(Float32Array.from(Array.from(a).flatMap((value, i) => [value, right[i]]))),
    );
});
test("CLI transport refuses success envelopes from failed or signaled real children", async () => {
  const { cliReply } = await import("./first-preview-transport.mjs");
  assert.deepEqual(await cliReply(["-e", "console.log(JSON.stringify({ok:true,data:7}))"]), {
    ok: true,
    data: 7,
  });
  assert.deepEqual(
    await cliReply([
      "-e",
      'console.log(JSON.stringify({ok:false,error:"expected"}));process.exitCode=1',
    ]),
    { ok: false, error: "expected" },
  );
  await assert.rejects(
    cliReply(["-e", "console.log(JSON.stringify({ok:true,data:7}));process.exitCode=2"]),
  );
  await assert.rejects(
    cliReply([
      "-e",
      'console.log(JSON.stringify({ok:true,data:7}));process.kill(process.pid,"SIGTERM")',
    ]),
  );
});
