import {
  AudioInspection,
  planAudioExcerpt,
  renderAudio,
  type AudioContext,
  type AudioOptions,
  type AudioSubmission,
  type MaterializedAudio,
  type NativeAudio,
} from "@screenrec/core/audio";
import { retainedFileRead } from "@screenrec/core/files";
import { PackageMediaContext, type PackageTarget } from "./package-media.js";
export type PackageAudioArtifact = MaterializedAudio & { outputId: string };

export class PackageAudioInspection extends AudioInspection<PackageTarget, PackageAudioArtifact> {
  constructor(private readonly media: PackageMediaContext) {
    super();
  }
  protected resolve(input: PackageTarget & { revisionId?: string | undefined }) {
    return this.media.resolve(input);
  }
  protected source() {
    return this.media.source();
  }
  protected retryJob(jobId: string) {
    this.media.retry(jobId);
  }
  protected plan(context: AudioContext<PackageTarget>, options: AudioOptions) {
    return planAudioExcerpt({ ...context, ...options }, this.media.sourceData().reader, (role) =>
      this.media.sourcePath(role),
    );
  }
  protected submit(
    context: AudioContext<PackageTarget>,
    options: AudioOptions,
  ): AudioSubmission<PackageAudioArtifact> {
    const result = this.media.submit<MaterializedAudio>(
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
    return {
      ...result,
      published: result.published
        ? { generation: result.published.generation, audio: result.published.value }
        : null,
    };
  }
  openRead(audio: PackageAudioArtifact) {
    return retainedFileRead(this.media.openOutput(audio.outputId), audio.bytes);
  }
}
