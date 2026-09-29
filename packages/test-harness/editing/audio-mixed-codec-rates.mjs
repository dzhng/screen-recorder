import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { applyBatch } from "../../composition/dist/index.js";

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
function difference(actual, expected) {
  assert.equal(actual.length, expected.length, "Sample cardinality changed");
  let maximum = 0,
    squared = 0,
    firstMismatch = null;
  for (let i = 0; i < actual.length; i++) {
    const d = Math.abs(actual[i] - expected[i]);
    maximum = Math.max(maximum, d);
    squared += d * d;
    if (d && firstMismatch === null) firstMismatch = i;
  }
  return { maximum, rms: Math.sqrt(squared / actual.length), firstMismatch };
}
export function verifyMixedCodecRates({
  out,
  worker,
  fixture,
  sources,
  call,
  render,
  clip,
  empty,
  scratch,
  wave,
  reference48,
  cohort = "compressed",
}) {
  assert(["compressed", "lossless-boundaries"].includes(cohort), "Unknown rate cohort");
  mkdirSync(out);
  const report = {
    passed: false,
    cohort,
    workerSHA256: hash(worker),
    cases: [],
    scope:
      "Unit-rate source sample-rate conversion and mixing; no listening or new codec tolerance",
    gate:
      cohort === "compressed"
        ? "Exact frozen-decoder PCM arithmetic; exact MP3 comparisons; AAC source seek uses existing maximum AND RMS bound. Independent resampled AAC comparisons are reported without a new tolerance."
        : "Exact authored source PCM, sample clocks, independent float sum, full/range/tail/split and channel controls; no independent resampler quality claim.",
  };
  const retain = (path, name) => {
    const target = join(out, name);
    copyFileSync(path, target);
    return { file: name, sha256: hash(target) };
  };
  report.reference48 = retain(reference48.binding.path, "reference-48.wav");
  try {
    const cases =
      cohort === "compressed"
        ? [
            ["aac", "m4a", 1, 44100],
            ["libmp3lame", "mp3", 2, 44100],
          ]
        : [
            ["pcm_s16le", "wav", 1, 8000],
            ["pcm_s16le", "wav", 2, 192000],
          ];
    for (const [codec, extension, channels, rate] of cases) {
      const lossless = codec === "pcm_s16le",
        name = lossless ? `${rate}-${channels}ch` : extension,
        entry = { codec, sourceRate: rate, channels, checks: {}, media: [] };
      report.cases.push(entry);
      const capture = (document, range, label) =>
        render(document, range, undefined, true, (result, request) => {
          entry.media.push({
            ...retain(result.file, `${name}-${label}.wav`),
            request,
            receipt: result,
          });
        });
      try {
        const raw = fixture(`rate-${name}`, rate, channels, (i, c) =>
          i === rate * 0.64 ? 0.75 : 0.125 * Math.sin((2 * Math.PI * (c ? 1700 : 430) * i) / rate),
        );
        entry.media.push(retain(raw.binding.path, `${name}-authored.wav`));
        const path = lossless ? raw.binding.path : join(scratch, `rate-${name}.${extension}`);
        if (!lossless) {
          const encoded = spawnSync(
            "ffmpeg",
            [
              "-nostdin",
              "-v",
              "error",
              "-i",
              raw.binding.path,
              "-c:a",
              codec,
              "-b:a",
              "192k",
              path,
            ],
            { encoding: "utf8", timeout: 30000 },
          );
          assert.equal(encoded.status, 0, encoded.stderr);
          entry.media.push(retain(path, `${name}-encoded.${extension}`));
        }
        const probe = call("media.probe", { path }),
          stream = probe.streams.find((v) => v.kind === "audio");
        assert.equal(stream.sampleRate, rate);
        assert.equal(stream.channels, channels);
        const available = [{ startUs: stream.startUs, endUs: stream.endUs }],
          source = {
            binding: {
              assetId: `rate-${name}`,
              streamId: stream.id,
              path,
              originUs: probe.originUs,
            },
            asset: {
              id: `rate-${name}`,
              streams: [{ id: stream.id, kind: "audio", bounds: available[0], available }],
            },
          };
        sources.push(source);
        entry.probe = probe;
        const endUs = stream.endUs;
        assert.equal(endUs, 2000000, "Fixture must retain its authored two-second endpoint");
        const selected = {
          source: path,
          streamId: stream.id,
          sourceOffsetUs: -probe.originUs,
          available,
        };
        const nativeRequest = {
          source: selected,
          range: { startUs: 0, endUs },
          output: join(scratch, `${name}-native-full.wav`),
        };
        const nativeFull = call("media.sourceAudio", nativeRequest);
        entry.nativeRequest = nativeRequest;
        entry.nativeReceipt = nativeFull;
        entry.media.push(retain(nativeFull.file, `${name}-native-full.wav`));
        assert.equal(nativeFull.frames, rate * 2);
        const nativePcm = wave(nativeFull.file, true, channels, rate);
        if (lossless) {
          entry.authoredSourceDifference = difference(nativePcm, raw.samples);
          assert.equal(entry.authoredSourceDifference.maximum, 0);
        }
        const isolated = {
          ...empty,
          tracks: [{ id: "compressed", kind: "audio", order: 0 }],
          clips: [clip("compressed", source, "compressed", 0, endUs)],
        };
        const mixed = {
          ...isolated,
          tracks: [...isolated.tracks, { id: "pcm48", kind: "audio", order: 1 }],
          clips: [...isolated.clips, clip("pcm48", reference48, "pcm48", 0, endUs)],
        };
        const full = capture(mixed, { startUs: 0, endUs }, "mixed-full"),
          component = capture(isolated, { startUs: 0, endUs }, "resampled-full");
        assert.equal(full.result.frames, 96000);
        assert.equal(component.result.frames, 96000);
        if (lossless) {
          const power = (channel, hz, pcm = component.samples) => {
            let re = 0,
              im = 0;
            for (let frame = 12000; frame < 24000; frame++) {
              const value = pcm[frame * 2 + channel],
                angle = (2 * Math.PI * hz * frame) / 48000;
              re += value * Math.cos(angle);
              im += value * Math.sin(angle);
            }
            return re * re + im * im;
          };
          entry.channelPowers = [0, 1].map((channel) => {
            const frequency = channels === 2 && channel === 1 ? 1700 : 430;
            const wanted = power(channel, frequency),
              other = power(channel, frequency === 430 ? 1700 : 430);
            assert(wanted > other, "Resampling changed channel identity");
            return { channel, frequency, wanted, other };
          });
          if (channels === 2) {
            const swapped = component.samples.map((_, index) => component.samples[index ^ 1]);
            assert.throws(
              () => assert(power(0, 430, swapped) > power(0, 1700, swapped)),
              assert.AssertionError,
            );
            entry.swappedChannelsRejected = true;
          }
          if (channels === 1)
            for (let frame = 0; frame < 96000; frame++)
              assert.equal(
                component.samples[frame * 2],
                component.samples[frame * 2 + 1],
                "Mono duplication differs",
              );
        }
        const expected = component.samples.map((v, i) => Math.fround(v + reference48.samples[i]));
        entry.fullSumDifference = difference(full.samples, expected);
        entry.checks.fullSumExact = entry.fullSumDifference.maximum === 0;
        entry.componentRequest = component.params;
        entry.componentReceipt = component.result;
        entry.fullRequest = full.params;
        entry.fullReceipt = full.result;
        entry.windows = [];
        for (const [label, range] of [
          ["range", { startUs: 123457, endUs: 1812349 }],
          ["tail", { startUs: endUs - 20003, endUs }],
        ]) {
          const start = Math.floor((range.startUs * 48000) / 1000000),
            end = Math.floor((range.endUs * 48000) / 1000000),
            window = capture(mixed, range, `mixed-${label}`),
            part = capture(isolated, range, `resampled-${label}`);
          assert.equal(window.result.frames, end - start);
          assert.equal(part.result.frames, end - start);
          const expectedWindow = part.samples.map((v, i) =>
            Math.fround(v + reference48.samples[start * 2 + i]),
          );
          const nativeRequest = {
            source: selected,
            range,
            output: join(scratch, `${name}-native-${label}.wav`),
          };
          const native = call("media.sourceAudio", nativeRequest);
          entry.media.push(retain(native.file, `${name}-native-${label}.wav`));
          const sourceStart = Math.floor((range.startUs * rate) / 1000000),
            sourceEnd = Math.floor((range.endUs * rate) / 1000000);
          assert.equal(native.frames, sourceEnd - sourceStart);
          const nativeDifference = difference(
            wave(native.file, true, channels, rate),
            nativePcm.slice(sourceStart * channels, sourceEnd * channels),
          );
          const row = {
            label,
            range,
            expectedProjectFrames: end - start,
            actualProjectFrames: window.result.frames,
            nativeSourceDifference: nativeDifference,
            independentSumDifference: difference(window.samples, expectedWindow),
            mixedFullRangeDifference: difference(
              window.samples,
              full.samples.slice(start * 2, end * 2),
            ),
            resampledComponentDifference: difference(
              part.samples,
              component.samples.slice(start * 2, end * 2),
            ),
            nativeRequest,
            nativeReceipt: native,
            componentRequest: part.params,
            componentReceipt: part.result,
            receipt: window.result,
            request: window.params,
          };
          entry.windows.push(row);
          assert(
            codec === "aac"
              ? nativeDifference.maximum < 1 / 32768 && nativeDifference.rms < 1 / 32768
              : nativeDifference.maximum === 0,
            "Existing source codec seek contract failed",
          );
        }
        const split = applyBatch(
          mixed,
          [
            {
              operation: "split",
              clipIds: ["compressed", "pcm48"],
              atUs: 333333,
              scope: "selected",
            },
          ],
          { assets: sources.map((s) => s.asset), namespace: `${name}-split` },
        );
        const splitOutput = capture(split.document, { startUs: 0, endUs }, "mixed-split");
        entry.splitRequest = splitOutput.params;
        entry.splitReceipt = splitOutput.result;
        entry.splitDifference = difference(splitOutput.samples, full.samples);

        // Omitted input and one-frame phase shift must be rejected by the same sum comparison.
        entry.negatives = {
          omitted48: difference(component.samples, expected),
          shiftedFrame: difference(full.samples.slice(2), expected.slice(0, -2)),
        };
        for (const metric of Object.values(entry.negatives))
          assert.throws(() => assert.equal(metric.maximum, 0), assert.AssertionError);
        // Reuse one frozen decoder result to isolate mixing from fresh codec invocations.
        const decoded = {
          binding: {
            ...source.binding,
            assetId: `${source.binding.assetId}-decoded`,
            path: nativeFull.file,
          },
          asset: { ...source.asset, id: `${source.asset.id}-decoded` },
        };
        sources.push(decoded);
        const controlled = {
          ...mixed,
          clips: [clip("compressed", decoded, "compressed", 0, endUs), mixed.clips[1]],
        };
        const controlledIsolated = { ...isolated, clips: [controlled.clips[0]] };
        entry.frozenDecodeControls = [];
        for (const [label, range] of [
          ["full", { startUs: 0, endUs }],
          ["range", { startUs: 123457, endUs: 1812349 }],
        ]) {
          const output = capture(controlled, range, `frozen-mixed-${label}`),
            component = capture(controlledIsolated, range, `frozen-component-${label}`);
          const start = Math.floor((range.startUs * 48000) / 1000000);
          const expected = component.samples.map((v, i) =>
            Math.fround(v + reference48.samples[start * 2 + i]),
          );
          const metric = difference(output.samples, expected);
          entry.frozenDecodeControls.push({
            label,
            difference: metric,
            request: output.params,
            receipt: output.result,
            componentRequest: component.params,
            componentReceipt: component.result,
          });
          assert.equal(metric.maximum, 0, "Frozen-decoder PCM mixing is not exact");
        }
        entry.checks.exactFullRange = entry.windows.every(
          (v) => v.mixedFullRangeDifference.maximum === 0,
        );
        entry.checks.exactIndependentSum =
          entry.checks.fullSumExact &&
          entry.windows.every((v) => v.independentSumDifference.maximum === 0);
        entry.checks.exactSplit = entry.splitDifference.maximum === 0;
        assert(
          codec === "aac" ||
            (entry.checks.exactFullRange &&
              entry.checks.exactIndependentSum &&
              entry.checks.exactSplit),
          "Lossless/MP3 full/range, independent sum or split differs; measurements retained without adding a tolerance",
        );
        entry.passed = true;
      } catch (error) {
        entry.error = String(error.stack ?? error);
      }
    }
    report.passed = report.cases.every((v) => v.passed);
    assert(report.passed, "Mixed compressed-rate cases failed; see retained report");
    return report;
  } finally {
    writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  }
}
