import type { Buffer } from "node:buffer";
import type { SpeechTranscriptionReceipt } from "../../core/src/transcript.js";

type Admission = Pick<SpeechTranscriptionReceipt, "execution" | "available">;

export function portHistoricalSpeechRaw(
  original: Buffer,
  admission: Admission,
): {
  body: Buffer;
  sha256: string;
  referenceReplay: Admission & { adapter: string; sourceSha256: string };
};
