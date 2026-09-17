import { parakeetModel } from "@screenrec/core/speech-models";

export const engines = {
  parakeet: {
    repository: "https://github.com/FluidInference/FluidAudio.git",
    version: "v0.15.7",
    revision: "41540ea237350afe5117a082b5c28eda642d0612",
    product: "fluidaudiocli",
    buildArguments: ["--disable-default-traits"],
    runtimeLicense: "Apache-2.0",
    modelLicense: "CC-BY-4.0",
    model: parakeetModel,
  },
};

export function normalize(raw) {
  if (!Array.isArray(raw.wordTimings)) throw new Error("Parakeet report has no word timings");
  const words = raw.wordTimings.map((w) => ({ text: w.word, start: w.startTime, end: w.endTime }));
  if (
    words.some(
      (w) =>
        !w.text ||
        !Number.isFinite(w.start) ||
        !Number.isFinite(w.end) ||
        w.start < 0 ||
        w.end < w.start,
    )
  )
    throw new Error("Invalid upstream word timing");
  return { text: raw.text, words };
}
