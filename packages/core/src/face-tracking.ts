import { faceObservationsSchema, type FaceObservations } from "@yap/protocol";
import { z } from "zod";

const sampleSchema = z
  .object({ atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER), observations: faceObservationsSchema })
  .strict();
export type FaceObservationSample = z.input<typeof sampleSchema>;
export type FaceTrackSample =
  | { atUs: number; status: "observed"; faceId: string; boundingBox: FaceObservations["faces"][number]["boundingBox"]; confidence: number }
  | { atUs: number; status: "gap"; reason: string };
export type FaceTrack = { id: string; samples: FaceTrackSample[]; ambiguous: boolean };

type Box = FaceObservations["faces"][number]["boundingBox"];
function iou(a: Box, b: Box) {
  const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
  return overlap / (a.width * a.height + b.width * b.height - overlap || 1);
}

/** Associate adjacent retained Vision observations without inventing identity across a gap. */
export function trackFaceObservations(input: readonly FaceObservationSample[]): FaceTrack[] {
  const samples = input.map((value) => sampleSchema.parse(value)).sort((a, b) => a.atUs - b.atUs);
  const tracks: FaceTrack[] = [];
  let previous: { track: FaceTrack; box: Box }[] = [];
  for (const sample of samples) {
    const observations = sample.observations;
    const next: { track: FaceTrack; box: Box }[] = [];
    const available = observations.status === "available" ? [...observations.faces] : [];
    const reason = observations.status === "available" ? "unmatched" : observations.reason ?? observations.status;
    for (const active of previous) active.track.samples.push({ atUs: sample.atUs, status: "gap", reason });
    const used = new Set<number>();
    for (const active of previous) {
      const candidates = available
        .map((face, index) => ({ face, index, score: iou(active.box, face.boundingBox) }))
        .filter(({ index, score }) => !used.has(index) && score >= 0.2)
        .sort((a, b) => b.score - a.score);
      if (!candidates.length) continue;
      if (candidates[1] && candidates[0]!.score - candidates[1].score < 0.05)
        active.track.ambiguous = true;
      const chosen = candidates[0]!;
      used.add(chosen.index);
      active.track.samples[active.track.samples.length - 1] = {
        atUs: sample.atUs,
        status: "observed",
        faceId: chosen.face.id,
        boundingBox: chosen.face.boundingBox,
        confidence: chosen.face.confidence,
      };
      next.push({ track: active.track, box: chosen.face.boundingBox });
    }
    if (observations.status === "no_face")
      for (const active of previous) if (!next.some((entry) => entry.track === active.track)) next.push(active);
    available.forEach((face, index) => {
      if (used.has(index)) return;
      const track: FaceTrack = { id: `track-${tracks.length}`, samples: [], ambiguous: false };
      track.samples.push({
        atUs: sample.atUs,
        status: "observed",
        faceId: face.id,
        boundingBox: face.boundingBox,
        confidence: face.confidence,
      });
      tracks.push(track);
      next.push({ track, box: face.boundingBox });
    });
    previous = next;
  }
  return tracks;
}
