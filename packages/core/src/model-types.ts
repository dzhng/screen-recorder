import type { voiceProfile } from "./voice-profile.js";
export type SpeechModelFile = Readonly<{ path: string; bytes: number; sha256: string }>;
/** The runtime and decoder evaluated with a model; native reports the same identity per transcript. */
export type SpeechRuntime = Readonly<{
  runtime: string;
  runtimeVersion: string;
  /** The source revision the worker's Package.resolved pins for `runtimeVersion`. */
  runtimeRevision: string;
  decoder: string;
}>;
/** The evaluated engine a transcript must come from. */
export type SpeechEnginePins = SpeechRuntime & Readonly<{ model: string; modelRevision: string }>;
export type ModelManifest = Readonly<{
  name: string;
  purpose: "transcription" | "voice" | "speaker" | "alignment";
  platform: Readonly<{ system: string; architecture: string }>;
  runtimeArtifact?: RuntimeArtifact;
  /** Require caller-supplied pinned model bytes; preparation cannot download them. */
  modelSourceRequired?: true;
  generationProfile?: typeof voiceProfile;
  repo: string;
  revision: string;
  /** FluidAudio loads from the parent directory joined with this exact folder name. */
  folderName: string;
  engine: SpeechRuntime;
  files: readonly SpeechModelFile[];
}>;
export type ModelStatus =
  | { state: "absent" | "ready" | "invalid" }
  | { state: "preparing"; receivedBytes: number; totalBytes: number }
  | { state: "failed"; code: string; message: string; retryable: boolean };
export type SpeechModelRequest = { directory: string; files: readonly SpeechModelFile[] };

export type RuntimeEntry = Readonly<
  { path: string; mode: number } & (
    | { kind: "directory" }
    | { kind: "symlink"; target: string }
    | { kind: "file"; bytes: number; sha256: string }
  )
>;
export type RuntimeArtifact = Readonly<{
  digest: string;
  entries: readonly RuntimeEntry[];
  python: string;
  entry: string;
  /** Curated upstream inputs and recipe; complete resulting inventory is independently verified. */
  acquisition?: RuntimeAcquisition;
}>;
export type RuntimeAcquisition = Readonly<{
  recipe: "python-wheels-v1";
  files: readonly (SpeechModelFile & Readonly<{ url: string }>)[];
  interpreterArchive: string;
  installs: readonly Readonly<{
    paths: readonly string[];
    sourceBuild?: true;
    forceReinstall?: true;
  }>[];
  resources: readonly Readonly<{ path: string; content: string; sha256: string }>[];
  nativePolicy: Readonly<{
    files: readonly Readonly<{
      path: string;
      sourceSha256: string;
      removeRpaths: readonly string[];
    }>[];
  }>;
}>;
export type RuntimeMaterializer = (input: {
  inputs: string;
  directory: string;
  acquisition: RuntimeAcquisition;
  signal: AbortSignal;
}) => Promise<void>;
export type ModelSources = Readonly<{
  runtimeSource?: string | undefined;
  modelSource?: string | undefined;
}>;
export type PreparedRuntime = Readonly<{
  python: string;
  entry: string;
  model: string;
  cache: string;
  descriptorDigest: string;
  runtimeDigest: string;
  modelDigest: string;
  runtimeRevision: string;
  modelRevision: string;
}>;
