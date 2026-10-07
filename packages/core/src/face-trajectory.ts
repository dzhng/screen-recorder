import { z } from "zod";
import {
  trackFaceObservations,
  type FaceObservationSample,
  type FaceTrack,
  type FaceTrackSample,
} from "./face-tracking.js";
import { faceObservationsSchema } from "@yap/protocol";

/** Immutable source identity that owns every observation in a trajectory. */
export const faceTrajectorySourceSchema = z
  .strictObject({
    assetId: z.string().min(1),
    streamId: z.string().min(1),
    acquisitionId: z.string().min(1).optional(),
    generation: z.string().min(1),
    supportDigest: z.string().min(1),
  });
export type FaceTrajectorySource = z.infer<typeof faceTrajectorySourceSchema>;

const trajectorySampleSchema = z
  .strictObject({
    ordinal: z.int().nonnegative(),
    atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    observations: faceObservationsSchema,
    reset: z.enum(["scene_change", "source_gap"]).optional(),
  })
  .superRefine((sample, context) => {
    if (sample.observations.status === "available" && sample.observations.faces.length === 0)
      context.addIssue({ code: "custom", message: "available samples require a face" });
  });
export type FaceTrajectoryInputSample = z.infer<typeof trajectorySampleSchema>;

const predictionSchema = z.enum(["none", "linear"]).default("none");
export type FacePredictionMethod = z.infer<typeof predictionSchema>;
export const faceTrajectoryInputSchema = z.strictObject({
  source: faceTrajectorySourceSchema,
  samples: z.array(trajectorySampleSchema).min(1),
  maxGapUs: z.int().positive().max(1_000_000).default(500_000),
  prediction: predictionSchema,
});
export type FaceTrajectoryInput = z.input<typeof faceTrajectoryInputSchema>;

export type FaceTrajectoryStatus = "observed" | "predicted" | "gap" | "ambiguous";
export type FaceTrajectorySample =
  | (Omit<Extract<FaceTrackSample, { status: "observed" }>, "status"> & {
      status: "observed" | "ambiguous";
      sourceObservationId: string;
      implementationId: string;
      width: number;
      height: number;
    })
  | { atUs: number; status: "gap"; reason: string; implementationId: string; width: number; height: number }
  | {
      atUs: number;
      status: "predicted";
      reason: "prediction_not_available";
      implementationId: string;
      width: number;
      height: number;
    };
export type FaceTrajectoryTrack = Omit<FaceTrack, "samples"> & { samples: FaceTrajectorySample[] };

export type FaceTrajectory = {
  schema: "face-trajectory-v1";
  clock: "source";
  source: FaceTrajectorySource;
  maxGapUs: number;
  prediction: {
    method: FacePredictionMethod;
    state: "disabled" | "refused";
    reason?: "prediction_not_implemented";
  };
  samples: FaceTrajectoryInputSample[];
  tracks: FaceTrajectoryTrack[];
  refusals: Array<{
    code: "full_face_occlusion";
    startOrdinal: number;
    endOrdinal: number;
    sampleCount: number;
    reason: "detector_no_face";
  }>;
};

/** Build source-bound evidence from retained detector observations. */
export function buildFaceTrajectory(input: FaceTrajectoryInput): FaceTrajectory {
  const parsed = faceTrajectoryInputSchema.parse(input);
  for (const [index, sample] of parsed.samples.entries()) {
    const firstOrdinal = parsed.samples[0]?.ordinal ?? 0;
    if (sample.ordinal !== firstOrdinal + index)
      throw new Error(`Face trajectory sample ordinal must be contiguous at ${firstOrdinal + index}`);
    if (index > 0 && sample.atUs <= parsed.samples[index - 1]!.atUs)
      throw new Error("Face trajectory sample clocks must be strictly increasing");
  }
  const samples = parsed.samples.map((sample) => ({ ...sample }));
  const tracks = trackFaceObservations(
    samples.map(({ atUs, observations, reset }): FaceObservationSample => ({
      atUs,
      observations,
      ...(reset === undefined ? {} : { reset }),
    })),
    { maxGapUs: parsed.maxGapUs },
  );
  const byAt = new Map<number, FaceTrajectoryInputSample>(samples.map((sample) => [sample.atUs, sample]));
  const trajectoryTracks: FaceTrajectoryTrack[] = tracks.map((track) => ({
    ...track,
    samples: track.samples.map((sample): FaceTrajectorySample => {
      const inputSample = byAt.get(sample.atUs)!;
      const observations = inputSample.observations;
      const common = {
        implementationId: observations.implementationId,
        width: observations.width,
        height: observations.height,
      };
      if (sample.status === "gap") return { ...sample, ...common };
      const ambiguous = track.ambiguousAtUs?.includes(sample.atUs) ?? false;
      return {
        ...sample,
        ...common,
        status: ambiguous ? "ambiguous" : "observed",
        sourceObservationId: sample.faceId,
      };
    }),
  }));
  const refusals: FaceTrajectory["refusals"] = [];
  let runStart: number | undefined;
  let runEnd: number | undefined;
  for (const [ordinal, sample] of samples.entries()) {
    if (sample.observations.status === "no_face") {
      runStart ??= ordinal;
      runEnd = ordinal;
    } else if (runStart !== undefined) {
      if (runEnd! - runStart + 1 >= 27)
        refusals.push({
          code: "full_face_occlusion",
          startOrdinal: runStart,
          endOrdinal: runEnd!,
          sampleCount: runEnd! - runStart + 1,
          reason: "detector_no_face",
        });
      runStart = runEnd = undefined;
    }
  }
  if (runStart !== undefined && runEnd! - runStart + 1 >= 27)
    refusals.push({
      code: "full_face_occlusion",
      startOrdinal: runStart,
      endOrdinal: runEnd!,
      sampleCount: runEnd! - runStart + 1,
      reason: "detector_no_face",
    });
  return {
    schema: "face-trajectory-v1",
    clock: "source",
    source: parsed.source,
    maxGapUs: parsed.maxGapUs,
    prediction:
      parsed.prediction === "none"
        ? { method: "none", state: "disabled" }
        : { method: parsed.prediction, state: "refused", reason: "prediction_not_implemented" },
    samples,
    tracks: trajectoryTracks,
    refusals,
  };
}
