import { expect, test } from "vitest";
import { planSubjectFraming } from "./subject-framing.js";

test("plans a bounded crop that places the selected face at the requested target", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [
      {
        id: "speaker-a",
        boundingBox: { x: 700, y: 300, width: 200, height: 300 },
        confidence: 0.98,
      },
      { id: "speaker-b", boundingBox: { x: 50, y: 100, width: 160, height: 220 }, confidence: 0.8 },
    ],
    subjectId: "speaker-a",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 3 },
    preservation: "crop",
  });

  expect(result).toEqual({
    status: "ready",
    geometry: {
      type: "geometry",
      crop: { x: 530, y: 180, width: 540, height: 540 },
      rect: { x: 0, y: 0, width: 1080, height: 1080 },
      fit: "stretch",
    },
    zoom: 2,
    violations: [],
  });
});

test("surfaces partial landmark coverage before offering subject framing", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [
      {
        id: "speaker",
        boundingBox: { x: 700, y: 300, width: 200, height: 300 },
        confidence: 0.99,
        landmarkCoverage: "partial",
        landmarkGroups: ["face_contour", "nose"],
      },
    ],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 3 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toContain("subject_landmarks_partial");
  expect(result.geometry?.crop).toEqual({ x: 530, y: 180, width: 540, height: 540 });
});

test("reports a zoom-cap violation instead of silently exceeding the caller bound", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 900, y: 450, width: 100, height: 100 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 200, y: 200 },
    zoom: { min: 1, max: 1.5 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toContain("zoom_cap");
  expect(result.zoom).toBe(1.5);
  expect(result.geometry?.crop).toEqual({ x: 590, y: 140, width: 720, height: 720 });
});

test("refuses missing or ambiguous subjects without inventing a crop", () => {
  const base = {
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 3 },
    preservation: "crop" as const,
  };
  expect(planSubjectFraming({ ...base, faces: [] })).toEqual({
    status: "refused",
    geometry: null,
    zoom: null,
    violations: ["subject_missing"],
  });
  expect(
    planSubjectFraming({
      ...base,
      faces: [
        { id: "speaker", boundingBox: { x: 100, y: 100, width: 200, height: 200 } },
        { id: "speaker", boundingBox: { x: 120, y: 100, width: 200, height: 200 } },
      ],
    }),
  ).toEqual({
    status: "refused",
    geometry: null,
    zoom: null,
    violations: ["subject_ambiguous"],
  });
});

test("reports the centering conflict when full-frame preservation cannot translate within the canvas", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 860, y: 0, width: 200, height: 200 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 0, y: 0 },
    zoom: { min: 0.5, max: 3 },
    preservation: "contain",
  });

  expect(result.status).toBe("refused");
  expect(result.geometry).toEqual({
    type: "geometry",
    rect: { x: 0, y: 236.25, width: 1080, height: 1080 },
    fit: "contain",
  });
  expect(result.violations).toEqual(["target_unreachable"]);
});

test("translates contained content when the target is reachable without cropping", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 860, y: 300, width: 200, height: 200 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 0, y: 0 },
    zoom: { min: 0.5, max: 1 },
    preservation: "contain",
  });

  expect(result).toEqual({
    status: "ready",
    geometry: {
      type: "geometry",
      rect: { x: 0, y: 78.75, width: 1080, height: 1080 },
      fit: "contain",
    },
    zoom: 0.5625,
    violations: [],
  });
});

test("refuses contain mode when its fixed scale falls outside the requested zoom bounds", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 860, y: 440, width: 200, height: 200 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 0, y: 0 },
    zoom: { min: 2, max: 3 },
    preservation: "contain",
  });

  expect(result.status).toBe("refused");
  expect(result.zoom).toBe(0.5625);
  expect(result.geometry).toEqual({ type: "geometry", fit: "contain" });
  expect(result.violations).toEqual(["zoom_floor"]);
});

test("keeps the subject in source corners and reports an unreachable target", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "corner", boundingBox: { x: 0, y: 0, width: 100, height: 100 } }],
    subjectId: "corner",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 4 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toEqual(["source_bounds", "target_unreachable"]);
  expect(result.geometry?.crop).toMatchObject({ x: 0, y: 0, width: 340, height: 340 });
});

test("preserves requested margins before reporting an off-center target conflict", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 700, y: 300, width: 200, height: 300 } }],
    subjectId: "speaker",
    target: { x: 0.2, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 3 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toEqual(["target_unreachable"]);
  expect(result.geometry?.crop).toEqual({ x: 580, y: 180, width: 540, height: 540 });
});

test("keeps refused edge proposals inside the source when margins exceed both edges", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "edge", boundingBox: { x: 1800, y: 900, width: 100, height: 100 } }],
    subjectId: "edge",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 1, max: 4 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toContain("source_bounds");
  expect(result.geometry?.crop).toEqual({ x: 1580, y: 740, width: 340, height: 340 });
});

test("reports a zoom-floor violation when the minimum zoom would cut into the requested margin", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 1080, height: 1080 },
    faces: [{ id: "speaker", boundingBox: { x: 700, y: 300, width: 200, height: 300 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 120, y: 120 },
    zoom: { min: 3, max: 3 },
    preservation: "crop",
  });

  expect(result.status).toBe("refused");
  expect(result.violations).toContain("zoom_floor");
  expect(result.zoom).toBe(3);
});

test("an infeasible uniform zoom refuses without offering a stretched crop", () => {
  const result = planSubjectFraming({
    source: { width: 1920, height: 1080 },
    canvas: { width: 640, height: 640 },
    faces: [{ id: "speaker", boundingBox: { x: 840, y: 300, width: 300, height: 300 } }],
    subjectId: "speaker",
    target: { x: 0.5, y: 0.5 },
    margins: { x: 72, y: 72 },
    zoom: { min: 0.1, max: 0.4 },
    preservation: "crop",
  });
  expect(result).toEqual({
    status: "refused",
    geometry: null,
    zoom: null,
    violations: ["zoom_cap", "source_bounds"],
  });
});
