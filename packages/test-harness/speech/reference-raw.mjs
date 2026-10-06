import { createHash } from "node:crypto";

// Reference-only admission port. Never claim the historical worker emitted these fields.
export function portHistoricalSpeechRaw(original, { execution, available }) {
  const sourceSha256 = createHash("sha256").update(original).digest("hex");
  const referenceReplay = {
    adapter: "historical-whole-support-ownership-v1",
    sourceSha256,
    execution,
    available,
  };
  const body = Buffer.from(
    original
      .toString("utf8")
      .trim()
      .split("\n")
      .map((value) => {
        const line = JSON.parse(value);
        return (
          JSON.stringify({ ...line, owned: line.owned ?? line.source, referenceReplay }) + "\n"
        );
      })
      .join(""),
  );
  return { body, sha256: createHash("sha256").update(body).digest("hex"), referenceReplay };
}
