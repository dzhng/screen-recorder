import { expect, test } from "vitest";
import { mediaProbeSchema } from "./assets.js";
import { readHdrConversionFacts, readHdrAudioConversionFacts } from "./hdr-conversion-facts.js";

function facts() {
  return {
    originUs: 0,
    streams: [
      {
        id: "track:1",
        kind: "video",
        codec: "hvc1",
        decodable: true,
        startUs: 0,
        endUs: 100_000,
        width: 16,
        height: 16,
        orientedWidth: 16,
        orientedHeight: 16,
        transform: [1, 0, 0, 1, 0, 0],
        segments: [
          { startUs: 0, endUs: 100_000, empty: false, mediaStartUs: 0, mediaDurationUs: 100_000 },
        ],
        hasAlpha: false,
        colorFormats: [
          {
            colorPrimaries: "ITU_R_2020",
            transferFunction: "SMPTE_ST_2084_PQ",
            ycbcrMatrix: "ITU_R_2020",
            fullRange: null,
            bitsPerComponent: 10,
            interpretationExtensions: [],
            invalidColorDeclarations: [],
          },
        ],
        codecAtomNames: [["hvcC"]],
        samples: {
          count: 3,
          firstPtsUs: 0,
          lastPtsUs: 66_667,
          minDurationUs: 33_333,
          maxDurationUs: 33_333,
          firstTimeUs: 0,
          lastTimeUs: { numerator: 200_000, denominator: 3 },
          lastDurationUs: { numerator: 100_000, denominator: 3 },
          presentedTimingSha256: "a".repeat(64),
        },
        compressedVideoInspection: {
          status: "complete",
          packetCount: 3,
          nalTypes: [20],
          configurationNalTypes: [32, 33, 34],
          seiPayloadTypes: [],
          refusals: [],
        },
      },
    ],
  };
}

test("cached asset summaries cannot substitute for fresh conversion facts", () => {
  const cached = mediaProbeSchema.parse(facts());
  expect(() => readHdrConversionFacts(cached, "track:1")).toThrowError(
    expect.objectContaining({ code: "INVALID_NATIVE_RESPONSE" }),
  );
});

test("fresh facts preserve fractional sample support and absent range declarations", () => {
  const input = facts();
  const parsed = readHdrConversionFacts(input, "track:1");
  expect(parsed.video.samples).toMatchObject({
    firstTimeUs: 0,
    lastTimeUs: { numerator: 200_000, denominator: 3 },
    lastDurationUs: { numerator: 100_000, denominator: 3 },
    presentedTimingSha256: "a".repeat(64),
  });
  expect(parsed.video.colorFormats).toEqual(input.streams[0]!.colorFormats);
  expect(parsed.video.codecAtomNames).toEqual([["hvcC"]]);
  expect(parsed.video.compressedVideoInspection).toEqual(
    input.streams[0]!.compressedVideoInspection,
  );
});

test("fresh selected audio preserves decoded support independently from cached packet summaries", () => {
  const value = {
    originUs: { numerator: 1, denominator: 3 },
    streams: [
      {
        id: "track:2",
        kind: "audio",
        codec: "aac ",
        decodable: true,
        startUs: 0,
        endUs: 125000,
        sampleRate: 48000,
        channels: 1,
        segments: [
          { startUs: 0, endUs: 125000, empty: false, mediaStartUs: 0, mediaDurationUs: 125000 },
        ],
        decodedAudioInspection: {
          sampleRate: 48000,
          channels: 1,
          frames: 6000,
          runs: [{ startUs: 0, endUs: 125000, frames: 6000 }],
          pcmSha256: "c".repeat(64),
          trimming: "decoder-output-attachment-free",
        },
      },
    ],
  };
  expect(readHdrAudioConversionFacts(value, "track:2").audio.decodedAudioInspection).toEqual(
    value.streams[0]!.decodedAudioInspection,
  );
  expect(() => readHdrAudioConversionFacts(mediaProbeSchema.parse(value), "track:2")).toThrowError(
    expect.objectContaining({ code: "INVALID_NATIVE_RESPONSE" }),
  );
});
