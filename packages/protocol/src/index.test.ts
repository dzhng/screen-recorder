import { describe, expect, it } from "vitest";
import { parseRequest } from "./index.js";

describe("native operation envelope", () => {
  it("rejects an unknown top-level field instead of silently accepting a misspelled request", () => {
    expect(() =>
      parseRequest({ id: "request-1", operation: "system.ping", params: {}, param: {} }),
    ).toThrow();
  });
});
