import { voiceProfile } from "./voice-profile.js";
import runtimeEntries from "./model-data/voice-runtime.json" with { type: "json" };
import { originalSpeakerManifest } from "./model-data/speaker-manifest.generated.js";
import { alignmentManifest } from "./model-data/alignment-manifest.generated.js";
import type { ModelManifest, RuntimeEntry } from "./model-types.js";
/**
 * Everything FluidAudio 0.15.7 AsrModels.load reads for Parakeet TDT v2 from a local directory,
 * plus the model card that carries the CC-BY-4.0 notice (the repository has no LICENSE file).
 * Sizes come from the Hub tree at this revision; hashes are the ones slice 04 evaluated.
 */
export const parakeetModel: ModelManifest = {
  name: "parakeet",
  purpose: "transcription",
  platform: { system: "darwin", architecture: "arm64" },
  repo: "FluidInference/parakeet-tdt-0.6b-v2-coreml",
  revision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
  folderName: "parakeet-tdt-0.6b-v2",
  engine: {
    runtime: "FluidAudio",
    runtimeVersion: "0.15.7",
    runtimeRevision: "41540ea237350afe5117a082b5c28eda642d0612",
    decoder: "parakeet-tdt-batch",
  },
  files: [
    {
      path: "Decoder.mlmodelc/analytics/coremldata.bin",
      bytes: 243,
      sha256: "46de1a6fe2e49d19a2125bc91acf020df7f2aea84ba821532aade8427a440b05",
    },
    {
      path: "Decoder.mlmodelc/coremldata.bin",
      bytes: 554,
      sha256: "d200ca07694a347f6d02a3886a062ae839831e094e443222f2e48a14945966a8",
    },
    {
      path: "Decoder.mlmodelc/metadata.json",
      bytes: 3427,
      sha256: "90a279b822496316458febc0ce761ab05954fadd9d66aa97bea077a35fc8f2b2",
    },
    {
      path: "Decoder.mlmodelc/model.mil",
      bytes: 13106,
      sha256: "7b95a5a6b672c652000348a67b6d4d92bb8e176b978c6666fe73c28a4d7ec579",
    },
    {
      path: "Decoder.mlmodelc/weights/weight.bin",
      bytes: 14429952,
      sha256: "27d26890221d82322c1092fd99d7b40578e435d5cf4b83c887c42603caf97aba",
    },
    {
      path: "Encoder.mlmodelc/analytics/coremldata.bin",
      bytes: 243,
      sha256: "42e638870d73f26b332918a3496ce36793fbb413a81cbd3d16ba01328637a105",
    },
    {
      path: "Encoder.mlmodelc/coremldata.bin",
      bytes: 485,
      sha256: "4def7aa848599ad0e17a8b9a982edcdbf33cf92e1f4b798de32e2ca0bc74b030",
    },
    {
      path: "Encoder.mlmodelc/metadata.json",
      bytes: 2926,
      sha256: "58222fbc48c13c49d9715567803cd50cb9c23e4360462e0f8ffcea59a2c73c63",
    },
    {
      path: "Encoder.mlmodelc/model.mil",
      bytes: 959769,
      sha256: "ed7b19156ca29fa7dfd6891deb9fda4b0e8893f68597c985d135736546a43808",
    },
    {
      path: "Encoder.mlmodelc/weights/weight.bin",
      bytes: 445187200,
      sha256: "4adc7ad44f9d05e1bffeb2b06d3bb02861a5c7602dff63a6b494aed3bf8a6c3e",
    },
    {
      path: "JointDecision.mlmodelc/analytics/coremldata.bin",
      bytes: 243,
      sha256: "f1183ba213bb94a918c8d2cad19ab045320618f97f6ca662245b3936d7b090f7",
    },
    {
      path: "JointDecision.mlmodelc/coremldata.bin",
      bytes: 534,
      sha256: "e2c6752f1c8cf2d3f6f26ec93195c9bfa759ad59edf9f806696a138154f96f11",
    },
    {
      path: "JointDecision.mlmodelc/metadata.json",
      bytes: 2936,
      sha256: "ba8d309417b9acd4a175fdb15687de6a941db2f5b06666a60e7cf3cc8e2d3c3c",
    },
    {
      path: "JointDecision.mlmodelc/model.mil",
      bytes: 9722,
      sha256: "93bf82042235127cb81ab537dcae47a1c2e7e242ce4ffdaf772981b45eedc4f0",
    },
    {
      path: "JointDecision.mlmodelc/weights/weight.bin",
      bytes: 3453388,
      sha256: "ca22a65903a05e64137677da608077578a8606090a598abf4875fa6199aaa19d",
    },
    {
      path: "Preprocessor.mlmodelc/analytics/coremldata.bin",
      bytes: 243,
      sha256: "03ab3c1327a054c54c07a40325db967ec574f2c91dcc8192bfa44aa561bcf2d8",
    },
    {
      path: "Preprocessor.mlmodelc/coremldata.bin",
      bytes: 494,
      sha256: "d88ea1fc349459c9e100d6a96688c5b29a1f0d865f544be103001724b986b6d6",
    },
    {
      path: "Preprocessor.mlmodelc/metadata.json",
      bytes: 2974,
      sha256: "fb16c581ff5e1b962e7cb2181ed892cd32f9f84c12b6e80ff3e089f28e35bcbb",
    },
    {
      path: "Preprocessor.mlmodelc/model.mil",
      bytes: 27166,
      sha256: "3e06d16fd061294c8a75be68c43a3b1ed1f593d4a9c35249e9cdbccadc59721e",
    },
    {
      path: "Preprocessor.mlmodelc/weights/weight.bin",
      bytes: 298880,
      sha256: "a5f7df6c7f47147ae9486fe18cc7792f9a44d093ec3c6a11e91ef2dc363c48dc",
    },
    {
      path: "README.md",
      bytes: 1665,
      sha256: "491eac9a160dc7b0f7ce1210dea4fff6df0222124e93ea83ae2cd72827b4ce02",
    },
    {
      path: "parakeet_vocab.json",
      bytes: 18762,
      sha256: "57019fe3c745772ca83a1b048a4bb951cd51329504ea33d4d83316b96e279a97",
    },
  ],
};

export const qwenVoiceModel: ModelManifest = {
  name: voiceProfile.id,
  generationProfile: voiceProfile,
  purpose: "voice",
  platform: {
    system: "darwin",
    architecture: "arm64",
  },
  repo: "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16",
  revision: "1eccf1cb2519b5a4e8a95b5f0544f3303568164f",
  folderName: "model",
  engine: {
    runtime: "mlx-audio",
    runtimeVersion: "0.5.6",
    runtimeRevision: "4ab7e6f7dedd69a136cfaa318c5dc8aed5119446",
    decoder: voiceProfile.id,
  },
  files: [
    {
      path: ".gitattributes",
      bytes: 1519,
      sha256: "11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361",
    },
    {
      path: "README.md",
      bytes: 1026,
      sha256: "d0c0b25c2cc544e864cafccee9d2447a04d1fba561060c0d88bd5c2bc1e5ea86",
    },
    {
      path: "config.json",
      bytes: 5317,
      sha256: "ee1871ab778c89645f8806df736cb35958619c40276598a41aeaa014615656a4",
    },
    {
      path: "generation_config.json",
      bytes: 245,
      sha256: "f1b90b4513f3b34c62851049e2492d7b4c5940daf1276f89c82b8ef04127f3aa",
    },
    {
      path: "merges.txt",
      bytes: 1671839,
      sha256: "599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3",
    },
    {
      path: "model.safetensors",
      bytes: 1829344448,
      sha256: "d7c7ed3e3464e3e59de0f955b3755891fa8319ff061c3f0307fe2e1343bc122d",
    },
    {
      path: "model.safetensors.index.json",
      bytes: 38573,
      sha256: "e02433c97b2894586e8842af2b40381c5bb644bc1c6bf71a6a52a727efe92313",
    },
    {
      path: "preprocessor_config.json",
      bytes: 127,
      sha256: "efdde1022ea9d76928bf7a9cd53139138f5ba2e466e837f08f6105ab1af1c119",
    },
    {
      path: "speech_tokenizer/config.json",
      bytes: 2336,
      sha256: "ee65bb901c876664ab8707c487157aa1a6ee57c65969b28fb5ec9dc211e68167",
    },
    {
      path: "speech_tokenizer/configuration.json",
      bytes: 76,
      sha256: "6bc26d64eb5024b4d1dab5a52371958b429256d6c9d59787f1f5294a54e0cebd",
    },
    {
      path: "speech_tokenizer/model.safetensors",
      bytes: 682293092,
      sha256: "836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258",
    },
    {
      path: "speech_tokenizer/preprocessor_config.json",
      bytes: 234,
      sha256: "fcb3805e597e786d4067706e602f6688524640f8d3396790e2e09b5942fcbdfb",
    },
    {
      path: "tokenizer_config.json",
      bytes: 7344,
      sha256: "dc3c31c3bdaedd5016382bb3cbe07323026775ad51f5a4fb564505992ae4a670",
    },
    {
      path: "vocab.json",
      bytes: 2776833,
      sha256: "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910",
    },
  ],
  runtimeArtifact: {
    digest: "3f20d26c32dfdc7d83f13e4e68cf3dab38ca5e6231f6bf9c2c20584b75805001",
    entries: runtimeEntries as RuntimeEntry[],
    python: "python/bin/python3.12",
    entry: "voice/worker.py",
  },
};
/** This exact30s runtime is provisional and requires explicit verified local inputs. */
export const speakerModel: ModelManifest = {
  ...originalSpeakerManifest,
  modelSourceRequired: true,
};
export const registeredModels = [
  parakeetModel,
  qwenVoiceModel,
  speakerModel,
  alignmentManifest,
] as const;
