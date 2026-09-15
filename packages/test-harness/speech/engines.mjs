export const engines = {
  parakeet: {
    repository: "https://github.com/FluidInference/FluidAudio.git",
    version: "v0.15.7",
    revision: "41540ea237350afe5117a082b5c28eda642d0612",
    product: "fluidaudiocli",
    buildArguments: ["--disable-default-traits"],
    runtimeLicense: "Apache-2.0",
    modelLicense: "CC-BY-4.0",
    modelRepo: "FluidInference/parakeet-tdt-0.6b-v2-coreml",
    modelRevision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
    include: [
      "Preprocessor.mlmodelc/*",
      "Encoder.mlmodelc/*",
      "Decoder.mlmodelc/*",
      "JointDecision.mlmodelc/*",
      "parakeet_vocab.json",
      "README.md",
      "LICENSE*",
    ],
    assetDirectory: "parakeet-tdt-0.6b-v2",
    modelFolder: "",
  },
  whisperkit: {
    repository: "https://github.com/argmaxinc/argmax-oss-swift.git",
    version: "v1.1.0",
    revision: "1e2a163736dfa5a198e637ae44c114e1c6d5cc2d",
    product: "argmax-cli",
    buildArguments: [],
    runtimeLicense: "MIT",
    modelLicense: "MIT",
    modelRepo: "argmaxinc/whisperkit-coreml",
    modelRevision: "0f63a7800b00dd0226abd051b906c246e1907482",
    include: ["openai_whisper-large-v3-v20240930_turbo/*", "README.md", "LICENSE*"],
    assetDirectory: "models",
    modelFolder: "openai_whisper-large-v3-v20240930_turbo",
    tokenizer: {
      repo: "openai/whisper-large-v3",
      revision: "06f233fe06e710322aca913c1bc4249a0d71fce1",
    },
  },
};

export function normalize(engine, raw) {
  let words;
  if (engine === "parakeet") {
    if (!Array.isArray(raw.wordTimings)) throw new Error("Parakeet report has no word timings");
    words = raw.wordTimings.map((w) => ({ text: w.word, start: w.startTime, end: w.endTime }));
  } else if (engine === "whisperkit") {
    if (!Array.isArray(raw.segments) || raw.segments.some((s) => !Array.isArray(s.words)))
      throw new Error("WhisperKit report has no word timings");
    words = raw.segments.flatMap((s) =>
      s.words.map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })),
    );
  } else throw new Error(`Unknown engine: ${engine}`);
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
