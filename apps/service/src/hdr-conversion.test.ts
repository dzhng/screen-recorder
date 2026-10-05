import { expect, test } from "vitest";
import { readHdrConversionFacts } from "@screenrec/core/hdr-conversion-facts";
import { add, fromTime, multiply, rational, toTime } from "@screenrec/composition";
import {
  prepareHdrClock,
  qualifyHdrInterpretation,
  validateHdrDerivative,
} from "./hdr-conversion.js";

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

test("physical clock preparation refuses a padded declared tail", () => {
  const raw = source();
  expect(prepareHdrClock(readHdrConversionFacts(raw, "track:1"))).toMatchObject({
    sourceClockAtDerivativeZeroUs: 0,
  });
  raw.streams[0]!.endUs = 126000;
  raw.streams[0]!.segments[0]!.endUs = 126000;
  raw.streams[0]!.segments[0]!.mediaDurationUs = 126000;
  expect(() => prepareHdrClock(readHdrConversionFacts(raw, "track:1"))).toThrowError(
    expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }),
  );
});

test("movie clock derives from exact fractional operands rather than a fixture default", () => {
  const facts = readHdrConversionFacts(source(), "track:1");
  const shifted = {
    ...facts,
    metadata: { ...facts.metadata, originUs: { numerator: 1, denominator: 3 } },
  };
  for (const input of [facts, shifted]) {
    const clock = prepareHdrClock(input);
    for (const operand of [
      input.metadata.originUs,
      input.video.samples.lastTimeUs,
      input.video.samples.lastDurationUs,
    ])
      expect(
        multiply(fromTime(operand), rational(BigInt(clock.movieTimescale), 1000000n)).denominator,
      ).toBe(1n);
  }
});

function derivative(facts = readHdrConversionFacts(source(), "track:1")) {
  const output = structuredClone(facts);
  output.video.codec = "ap4h";
  output.video.codecAtomNames = [[]];
  output.video.colorFormats = [
    {
      colorPrimaries: "ITU_R_709_2",
      transferFunction: "ITU_R_709_2",
      ycbcrMatrix: "ITU_R_709_2",
      fullRange: null,
      bitsPerComponent: 12,
      interpretationExtensions: [],
      invalidColorDeclarations: [],
    },
  ];
  output.metadata.streams = [output.video];
  return output;
}

test("derivative admission requires exact retained samples, support and SDR interpretation", () => {
  const input = readHdrConversionFacts(source(), "track:1");
  const good = derivative(input);
  expect(() => validateHdrDerivative(input, good)).not.toThrow();
  const changed = structuredClone(good);
  changed.video.samples.lastTimeUs = 83334;
  expect(() => validateHdrDerivative(input, changed)).toThrowError(
    expect.objectContaining({ code: "INVALID_NATIVE_RESPONSE" }),
  );
});

test("derivative admission preserves a nonzero common clock and refuses extra or retimed output", () => {
  const input = readHdrConversionFacts(source(), "track:1");
  const output = derivative(input);
  const shift = rational(1380001n, 3n);
  input.metadata.originUs = { numerator: 1, denominator: 3 };
  for (const key of ["startUs", "endUs"] as const)
    input.video[key] = toTime(add(fromTime(input.video[key]), shift));
  for (const key of ["firstTimeUs", "lastTimeUs"] as const)
    input.video.samples[key] = toTime(add(fromTime(input.video.samples[key]), shift));
  for (const key of ["startUs", "endUs"] as const)
    input.video.segments[0]![key] = toTime(add(fromTime(input.video.segments[0]![key]), shift));
  output.metadata.originUs = toTime(add(fromTime(input.metadata.originUs), shift));
  expect(() => validateHdrDerivative(input, output)).not.toThrow();
  const cases = [
    (value: typeof output) => {
      value.metadata.originUs = 0;
    },
    (value: typeof output) => {
      value.metadata.streams.push({ ...value.video, id: "track:2" });
    },
    (value: typeof output) => {
      value.video.samples.presentedTimingSha256 = "b".repeat(64);
    },
    (value: typeof output) => {
      value.video.segments[0]!.mediaDurationUs = 124999;
    },
    (value: typeof output) => {
      value.video.transform[0] = -1;
    },
    (value: typeof output) => {
      value.video.colorFormats[0]!.transferFunction = "SMPTE_ST_2084_PQ";
    },
  ];
  for (const mutate of cases) {
    const changed = structuredClone(output);
    mutate(changed);
    expect(() => validateHdrDerivative(input, changed)).toThrowError(
      expect.objectContaining({ code: "INVALID_NATIVE_RESPONSE" }),
    );
  }
});

test("clock admission refuses retimed, fragmented and unrepresentable support", () => {
  const facts = readHdrConversionFacts(source(), "track:1");
  for (const mutate of [
    (value: typeof facts) => {
      value.video.segments[0]!.mediaDurationUs = 125001;
    },
    (value: typeof facts) => {
      value.video.segments.push({ ...value.video.segments[0]! });
    },
    (value: typeof facts) => {
      value.metadata.originUs = { numerator: 1, denominator: 2147483647 };
    },
  ]) {
    const changed = structuredClone(facts);
    mutate(changed);
    expect(() => prepareHdrClock(changed)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_MEDIA" }),
    );
  }
});
