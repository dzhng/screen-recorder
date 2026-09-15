import { expect, it } from "vitest";
import { JsonLineReader, encodeJsonLine } from "./framing.js";

it("decodes a UTF-8 character split across incoming chunks without replacing it", () => {
  const frame = encodeJsonLine({ text: "A🙂B" }, 100);
  const split = frame.indexOf(Buffer.from("🙂")) + 2;
  const reader = new JsonLineReader(100);
  reader.push(frame.subarray(0, split));
  reader.push(frame.subarray(split));
  expect(reader.finish()).toEqual({ text: "A🙂B" });
});

it("rejects undefined request fields instead of silently deleting them on the wire", () => {
  expect(() =>
    encodeJsonLine({ operation: "edit.cut", params: { expectedRevisionId: undefined } }, 1000),
  ).toThrow();
});
