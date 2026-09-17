import {
  AudioInspection,
  planAudioExcerpt,
  renderAudio,
  type AudioOptions,
  type MaterializedAudio,
  type NativeAudio,
} from "@screenrec/core/audio";
import type { DerivativeContext } from "@screenrec/core/derivative-inspection";
import { retainedFileRead } from "@screenrec/core/files";
import { PackageMediaContext, type PackageTarget } from "./package-media.js";
export type PackageAudioArtifact = MaterializedAudio & { outputId: string };

export class PackageAudioInspection extends AudioInspection<PackageTarget, PackageAudioArtifact> {
  constructor(private readonly media: PackageMediaContext) {
    super(media);
  }
  protected plan(context: DerivativeContext<PackageTarget>, options: AudioOptions) {
    return planAudioExcerpt({ ...context, ...options }, this.media.sourceData().reader, (role) =>
      this.media.sourcePath(role),
    );
  }
  protected submit(context: DerivativeContext<PackageTarget>, options: AudioOptions) {
    return this.media.submit<MaterializedAudio>(
      "audio",
      JSON.stringify({ revisionId: context.revision.id, options }),
      (output, run, signal) =>
        renderAudio(
          options,
          { ...context, output },
          {
            evidence: this.media.sourceData().reader,
            resolveSource: (role) => this.media.sourcePath(role),
            decode: async (params, signal) =>
              (await run("media.audio", params, signal)) as NativeAudio,
          },
          signal,
        ),
    );
  }
  openRead(audio: PackageAudioArtifact) {
    return retainedFileRead(this.media.openOutput(audio.outputId), audio.bytes);
  }
}
