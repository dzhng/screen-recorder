import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from "node:fs";
import { mkdir, open, rename, rm, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { O_NOFOLLOW_ANY } from "./files.js";
import { CatalogError } from "./catalog.js";

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
export type SpeechModelManifest = Readonly<{
  name: string;
  repo: string;
  revision: string;
  /** FluidAudio loads from the parent directory joined with this exact folder name. */
  folderName: string;
  engine: SpeechRuntime;
  files: readonly SpeechModelFile[];
}>;
export type SpeechModelStatus =
  | { state: "absent" | "ready" | "invalid" }
  | { state: "preparing"; receivedBytes: number; totalBytes: number }
  | { state: "failed"; code: string; message: string; retryable: boolean };
export type SpeechModelRequest = { directory: string; files: readonly SpeechModelFile[] };

/**
 * Everything FluidAudio 0.15.7 AsrModels.load reads for Parakeet TDT v2 from a local directory,
 * plus the model card that carries the CC-BY-4.0 notice (the repository has no LICENSE file).
 * Sizes come from the Hub tree at this revision; hashes are the ones slice 04 evaluated.
 */
export const parakeetModel: SpeechModelManifest = {
  name: "parakeet",
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

type Receipt = {
  modelDigest: string;
  files: Record<string, { modifiedNs: string; inode: string }>;
};
type Flight = {
  readonly controller: AbortController;
  done: Promise<void>;
  participants: number;
  receivedBytes: number;
};

const storageFailure = (error: unknown) =>
  error instanceof CatalogError
    ? error
    : new CatalogError(
        "MODEL_STORAGE_FAILED",
        `Model storage failed: ${(error as Error).message}`,
        {
          cause: (error as NodeJS.ErrnoException).code,
        },
      );
async function stored<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw storageFailure(error);
  }
}
function privateDirectory(path: string): void {
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!lstatSync(path).isDirectory())
    throw new CatalogError("MODEL_STORAGE_FAILED", "Model directory must not be a link");
}
async function writeAll(handle: FileHandle, data: Uint8Array): Promise<void> {
  for (let offset = 0; offset < data.byteLength;)
    offset += (await handle.write(data, offset)).bytesWritten;
}
/** Creates a new regular file that cannot land through a symlinked path component. */
const createFile = (path: string) =>
  open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW_ANY, 0o600);

/**
 * Owns the pinned speech model under `<home>/models/<name>/<revision>/<folderName>`. Only
 * `prepare` uses the network; status and the native request read local files alone.
 */
export class SpeechModels {
  readonly modelDigest: string;
  readonly pins: SpeechEnginePins;
  private readonly models: string;
  private flight: Flight | undefined;
  private failure: CatalogError | undefined;
  constructor(
    home: string,
    private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
    readonly manifest: SpeechModelManifest = parakeetModel,
  ) {
    this.modelDigest = createHash("sha256")
      .update(
        JSON.stringify(
          [...manifest.files]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map((file) => [file.path, file.bytes, file.sha256]),
        ),
      )
      .digest("hex");
    this.pins = { ...manifest.engine, model: manifest.repo, modelRevision: manifest.revision };
    this.models = join(realpathSync(home), "models");
    try {
      privateDirectory(this.models);
      privateDirectory(join(this.models, manifest.name));
      // A staging directory outliving its process can only be an interrupted prepare.
      rmSync(join(this.models, ".staging"), { recursive: true, force: true });
      privateDirectory(join(this.models, ".staging"));
    } catch (error) {
      throw storageFailure(error);
    }
  }

  status(): SpeechModelStatus {
    if (this.flight)
      return {
        state: "preparing",
        receivedBytes: this.flight.receivedBytes,
        totalBytes: this.manifest.files.reduce((total, file) => total + file.bytes, 0),
      };
    const state = this.inspect();
    if (state === "ready" || !this.failure) return { state };
    const { code, message, retryable } = this.failure;
    return { state: "failed", code, message, retryable };
  }

  /** The model part of a native speech.transcribe request; native re-verifies every listed file. */
  nativeRequest(): SpeechModelRequest {
    if (this.inspect() !== "ready")
      throw new CatalogError(
        "MODEL_NOT_PREPARED",
        "Speech model is not prepared",
        { state: this.status().state },
        true,
      );
    return { directory: join(this.root, this.manifest.folderName), files: this.manifest.files };
  }

  /** Joins any prepare in flight; the download stops only once every joined caller aborted. */
  prepare(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const flight =
      this.flight && !this.flight.controller.signal.aborted ? this.flight : this.start();
    flight.participants += 1;
    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        flight.participants -= 1;
        if (flight.participants === 0) {
          flight.controller.abort(signal.reason);
          // The final caller owns shutdown: do not release its lifetime before staging cleanup.
          void flight.done.then(
            () => reject(signal.reason),
            () => reject(signal.reason),
          );
        } else reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      flight.done.finally(() => signal.removeEventListener("abort", abort)).then(resolve, reject);
    });
  }

  private get root(): string {
    return join(this.models, this.manifest.name, this.manifest.revision);
  }

  private start(): Flight {
    this.failure = undefined;
    const flight: Flight = {
      controller: new AbortController(),
      done: Promise.resolve(),
      participants: 0,
      receivedBytes: 0,
    };
    this.flight = flight;
    flight.done = this.run(flight);
    return flight;
  }

  private async run(flight: Flight): Promise<void> {
    try {
      await this.install(flight);
    } catch (error) {
      if (flight.controller.signal.aborted) throw flight.controller.signal.reason;
      this.failure = storageFailure(error);
      throw this.failure;
    } finally {
      if (this.flight === flight) this.flight = undefined;
    }
  }

  private inspect(): "absent" | "ready" | "invalid" {
    const root = this.root;
    try {
      lstatSync(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
      return "invalid";
    }
    try {
      const folder = join(root, this.manifest.folderName);
      for (const path of [this.models, dirname(root), root, folder])
        if (!lstatSync(path).isDirectory()) return "invalid";
      const fd = openSync(join(root, "receipt.json"), constants.O_RDONLY | O_NOFOLLOW_ANY);
      let receipt: Receipt;
      try {
        receipt = JSON.parse(readFileSync(fd, "utf8")) as Receipt;
      } finally {
        closeSync(fd);
      }
      if (receipt.modelDigest !== this.modelDigest) return "invalid";
      const present = new Map<string, BigIntStats>();
      const walk = (directory: string, prefix: string) => {
        for (const name of readdirSync(directory)) {
          const path = join(directory, name),
            stat = lstatSync(path, { bigint: true });
          if (stat.isDirectory()) walk(path, `${prefix}${name}/`);
          else present.set(`${prefix}${name}`, stat);
        }
      };
      walk(folder, "");
      if (present.size !== this.manifest.files.length) return "invalid";
      for (const file of this.manifest.files) {
        const stat = present.get(file.path),
          identity = receipt.files[file.path];
        if (
          !stat?.isFile() ||
          stat.size !== BigInt(file.bytes) ||
          String(stat.mtimeNs) !== identity?.modifiedNs ||
          String(stat.ino) !== identity.inode
        )
          return "invalid";
      }
      return "ready";
    } catch {
      return "invalid";
    }
  }

  private async install(flight: Flight): Promise<void> {
    if (this.inspect() === "ready") return;
    const signal = flight.controller.signal;
    const staging = join(this.models, ".staging", randomUUID());
    try {
      const folder = join(staging, this.manifest.folderName);
      await stored(() => mkdir(folder, { recursive: true, mode: 0o700 }));
      const receipt: Receipt = { modelDigest: this.modelDigest, files: {} };
      for (const file of this.manifest.files)
        receipt.files[file.path] = await this.download(file, folder, flight);
      await stored(async () => {
        const handle = await createFile(join(staging, "receipt.json"));
        try {
          await writeAll(handle, Buffer.from(JSON.stringify(receipt)));
          await handle.datasync();
        } finally {
          await handle.close();
        }
      });
      signal.throwIfAborted();
      await stored(async () => {
        try {
          await rename(staging, this.root);
        } catch (error) {
          if (!["ENOTEMPTY", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? ""))
            throw error;
          if (this.inspect() === "ready") return;
          // Replace an invalid install whole: the old tree moves into staging before removal.
          const replaced = join(this.models, ".staging", randomUUID());
          await rename(this.root, replaced);
          await rename(staging, this.root);
          await rm(replaced, { recursive: true, force: true });
        }
      });
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async download(
    file: SpeechModelFile,
    folder: string,
    flight: Flight,
  ): Promise<Receipt["files"][string]> {
    const target = join(folder, file.path);
    await stored(() => mkdir(dirname(target), { recursive: true, mode: 0o700 }));
    const failed = (reason: string, details: Record<string, unknown> = {}) =>
      new CatalogError(
        "MODEL_DOWNLOAD_FAILED",
        `Model download failed: ${reason}`,
        { path: file.path, ...details },
        true,
      );
    const mismatch = (details: Record<string, unknown>) =>
      new CatalogError("MODEL_HASH_MISMATCH", "Downloaded model file does not match its pin", {
        path: file.path,
        expectedBytes: file.bytes,
        expectedSha256: file.sha256,
        ...details,
      });
    const path = file.path.split("/").map(encodeURIComponent).join("/");
    let response: Response;
    try {
      response = await this.fetch(
        `https://huggingface.co/${this.manifest.repo}/resolve/${this.manifest.revision}/${path}`,
        { signal: flight.controller.signal },
      );
    } catch (error) {
      throw failed((error as Error).message);
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {});
      throw failed(`HTTP ${response.status}`, { status: response.status });
    }
    const reader = response.body.getReader();
    try {
      const handle = await stored(() => createFile(target));
      try {
        const hash = createHash("sha256");
        let bytes = 0;
        for (;;) {
          const received = bytes;
          const chunk = await reader.read().catch((error: Error) => {
            throw failed(error.message, { receivedBytes: received });
          });
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          flight.receivedBytes += chunk.value.byteLength;
          if (bytes > file.bytes) throw mismatch({ receivedBytes: bytes });
          hash.update(chunk.value);
          await stored(() => writeAll(handle, chunk.value));
        }
        if (bytes !== file.bytes) throw mismatch({ receivedBytes: bytes });
        const sha256 = hash.digest("hex");
        if (sha256 !== file.sha256) throw mismatch({ sha256 });
        return await stored(async () => {
          await handle.datasync();
          const stat = await handle.stat({ bigint: true });
          return { modifiedNs: String(stat.mtimeNs), inode: String(stat.ino) };
        });
      } finally {
        await handle.close();
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
  }
}
