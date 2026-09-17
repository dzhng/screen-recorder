import { expect, test } from "vitest";
import { wordKind } from "./word-kind.js";

test("word kinds follow the fixed rule over folded emitted text", () => {
  expect(["Um,", "uh-huh", "Uhm.", "hello", "Mm-hmm!", '"er"', "umbrella"].map(wordKind)).toEqual([
    "filler",
    "vocalization",
    "filler",
    "speech",
    "vocalization",
    "filler",
    "speech",
  ]);
});
