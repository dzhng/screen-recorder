import { expect, test } from "vitest";
import { readHdrConversionFacts } from "@screenrec/core/hdr-conversion-facts";
import { qualifyHdrInterpretation } from "./hdr-conversion.js";

function source() {
  return {
    originUs: 0,
    streams: [
      {
        id: "track:1",
        kind: "video",
        codec: "hvc1",
        decodable: true,
        startUs: 0,
        endUs: 125000,
        width: 320,
        height: 192,
        orientedWidth: 320,
        orientedHeight: 192,
        transform: [1, 0, 0, 1, 0, 0],
        hasAlpha: false,
        segments: [
          { startUs: 0, endUs: 125000, empty: false, mediaStartUs: 0, mediaDurationUs: 125000 },
        ],
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
          lastPtsUs: 83333,
          minDurationUs: 41667,
          maxDurationUs: 41667,
          firstTimeUs: 0,
          lastTimeUs: { numerator: 250000, denominator: 3 },
          lastDurationUs: { numerator: 125000, denominator: 3 },
          presentedTimingSha256: "a".repeat(64),
        },
        compressedVideoInspection: {
          status: "complete",
          packetCount: 3,
          nalTypes: [1, 20],
          configurationNalTypes: [32, 33, 34],
          seiPayloadTypes: [],
          refusals: [],
        },
      },
    ],
  };
}
const color = {
  colorPrimaries: "bt2020",
  transferFunction: "smpte2084",
  ycbcrMatrix: "bt2020nc",
  range: "tv",
  pixelFormat: "yuv420p10le",
};

test("only a clear native family with agreeing held FFprobe declarations qualifies", () => {
  const facts = readHdrConversionFacts(source(), "track:1");
  expect(qualifyHdrInterpretation(facts, color)).toMatchObject({ family: "pq" });
  expect(() => qualifyHdrInterpretation(facts, { ...color, range: null })).toThrowError(
    expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }),
  );
  expect(() =>
    qualifyHdrInterpretation(facts, { ...color, transferFunction: "arib-std-b67" }),
  ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }));
  expect(() =>
    qualifyHdrInterpretation(
      {
        ...facts,
        video: {
          ...facts.video,
          colorFormats: [{ ...facts.video.colorFormats[0]!, transferFunction: null }],
        },
      },
      color,
    ),
  ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }));
});

test("absent compressed inspection and native interpretation refusals cannot qualify", () => {
  const facts = readHdrConversionFacts(source(), "track:1");
  const { compressedVideoInspection: _inspection, ...uninspected } = facts.video;
  expect(() => qualifyHdrInterpretation({ ...facts, video: uninspected }, color)).toThrowError(
    expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }),
  );
  expect(() =>
    qualifyHdrInterpretation(
      {
        ...facts,
        video: {
          ...facts.video,
          compressedVideoInspection: {
            ...facts.video.compressedVideoInspection!,
            refusals: ["unqualified NAL type 62"],
          },
        },
      },
      color,
    ),
  ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }));
});

test("alpha, proprietary codec atoms and full-range declarations stay outside this interpretation", () => {
  const facts = readHdrConversionFacts(source(), "track:1");
  for (const change of [
    { hasAlpha: true },
    { codec: "hev1" },
    { codecAtomNames: [["hvcC", "dvcC"]] },
    { colorFormats: [{ ...facts.video.colorFormats[0]!, fullRange: true }] },
  ])
    expect(() =>
      qualifyHdrInterpretation({ ...facts, video: { ...facts.video, ...change } }, color),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }));
});
