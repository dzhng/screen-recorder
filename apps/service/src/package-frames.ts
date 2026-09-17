import {
  FrameInspection,
  renderFrame,
  type FrameContext,
  type FrameOptions,
  type FrameSubmission,
} from "@screenrec/core/frames";
import type { MaterializedFrame, NativeFrame } from "@screenrec/core/frame-materialization";
import type { VisualObservations } from "@screenrec/core/scenes";
import { openRetainedImage } from "@screenrec/core/retained-image";
import { retainedFileRead } from "@screenrec/core/files";
import { PackageMediaContext, type PackageTarget } from "./package-media.js";
export type PackageFrameArtifact = MaterializedFrame & { outputId: string };

export class PackageFrameInspection extends FrameInspection<PackageTarget, PackageFrameArtifact> {
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
  protected submit(
    context: FrameContext<PackageTarget>,
    options: FrameOptions,
  ): FrameSubmission<PackageFrameArtifact> {
    const media = this.media;
    const result = media.submit<MaterializedFrame>(
      "frame",
      JSON.stringify({ revisionId: context.revision.id, options }),
      (output, run, signal) =>
        renderFrame(
          options,
          { ...context, source: "source/video.mov", output },
          {
            get evidence() {
              return media.sourceData().reader;
            },
            decode: async (params, signal) =>
              (await run("media.frame", params, signal)) as NativeFrame,
            sample: async ({ source, kept, atSourceUs }, signal) =>
              (await run(
                "media.visualSamples",
                { source, kept, atSourceUs },
                signal,
              )) as VisualObservations,
          },
          signal,
        ),
    );
    return {
      ...result,
      published: result.published
        ? { generation: result.published.generation, frame: result.published.value }
        : null,
    };
  }
  openRead(frame: PackageFrameArtifact) {
    const read = openRetainedImage(this.media.openOutput(frame.outputId), frame);
    return retainedFileRead(read.file, frame.bytes);
  }
}
