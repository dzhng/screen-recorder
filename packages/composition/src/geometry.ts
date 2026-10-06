import { lutParameters } from "./lut.js";
import { sdrCorrectionParameters } from "./sdr-correction.js";
import { z } from "zod";
import { CompositionError } from "./errors.js";

const coordinate = z.number().finite();
const size = z.number().finite().positive();
const point = z.object({ x: coordinate, y: coordinate }).strict();
export function geometrySchemaWithScalars<
  C extends z.ZodType,
  S extends z.ZodType,
  P extends z.ZodType,
>(scalar: { coordinate: C; size: S; pivot: P }) {
  const box = z
    .object({ x: scalar.coordinate, y: scalar.coordinate, width: scalar.size, height: scalar.size })
    .strict();
  return z
    .object({
      type: z.literal("geometry"),
      crop: box.optional(),
      rect: box.optional(),
      fit: z.enum(["contain", "cover", "stretch"]).optional(),
      scale: z.object({ x: scalar.coordinate, y: scalar.coordinate }).strict().optional(),
      rotationDeg: scalar.coordinate.optional(),
      pivot: z.object({ x: scalar.pivot, y: scalar.pivot }).strict().optional(),
    })
    .strict();
}
export const geometrySchema = geometrySchemaWithScalars({
  coordinate,
  size,
  pivot: z.number().min(0).max(1),
});
export type Geometry = z.infer<typeof geometrySchema>;
export type ImageDomain = { width: number; height: number };
export type Affine = [number, number, number, number, number, number];
export const picturePrimitiveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sdr-correction"), ...sdrCorrectionParameters }).strict(),
  z.object({ kind: z.literal("lut"), ...lutParameters }).strict(),
  z.object({ kind: z.literal("rasterize"), width: size, height: size }).strict(),
  z
    .object({ kind: z.literal("clamp"), x: coordinate, y: coordinate, width: size, height: size })
    .strict(),
  z
    .object({
      kind: z.literal("coverage"),
      points: z.array(point).length(4),
      width: size,
      height: size,
    })
    .strict(),
  z
    .object({
      kind: z.literal("affine"),
      matrix: z.tuple([coordinate, coordinate, coordinate, coordinate, coordinate, coordinate]),
    })
    .strict(),
  z.object({ kind: z.literal("opacity"), opacity: z.number().min(0).max(1) }).strict(),
]);
export type PicturePrimitive = z.infer<typeof picturePrimitiveSchema>;

// [a,b,c,d,tx,ty] maps x'=a*x+c*y+tx, y'=b*x+d*y+ty.
function multiply(a: Affine, b: Affine): Affine {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function raster(
  matrix: Affine,
  inputHeight: number,
  outputHeight: number,
): { kind: "affine"; matrix: Affine } {
  const [a, b, c, d, x, y] = matrix;
  // Compile the top-left authoring bridge once; the raster worker only applies this matrix.
  return {
    kind: "affine",
    matrix: [a, -b, -c, d, c * inputHeight + x, outputHeight - d * inputHeight - y].map((v) =>
      v === 0 ? 0 : v,
    ) as Affine,
  };
}
/** Crop/fit/pivot in authoring coordinates, emitted in the raster's lower-left coordinates. */
export function compileGeometry(
  input: ImageDomain,
  canvas: ImageDomain,
  step: Geometry,
  pixelBounds?: Geometry["crop"],
): PicturePrimitive[] {
  const source = step.crop ?? { x: 0, y: 0, ...input };
  const rect = step.rect ?? { x: 0, y: 0, ...canvas };
  const fit = step.fit ?? "contain";
  let sx = rect.width / source.width,
    sy = rect.height / source.height;
  if (fit !== "stretch") sx = sy = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  const sourceBounds = !step.crop && fit === "contain" ? pixelBounds : undefined;
  // Preserve the measured positive-scale affine-fusion bounds of the oriented encoded rectangle.
  const fittedWidth = sourceBounds
    ? Math.ceil((sourceBounds.x + sourceBounds.width) * sx) - Math.floor(sourceBounds.x * sx)
    : source.width * sx;
  const fittedHeight = sourceBounds
    ? Math.ceil((input.height - sourceBounds.y) * sy) -
      Math.floor((input.height - sourceBounds.y - sourceBounds.height) * sy)
    : source.height * sy;
  const scaled: Affine = [
    sx,
    0,
    0,
    sy,
    -source.x * sx,
    -(input.height - source.y - source.height) * sy,
  ];
  const centered: Affine = [
    1,
    0,
    0,
    1,
    (rect.width - fittedWidth) / 2,
    canvas.height - rect.height + (rect.height - fittedHeight) / 2,
  ];
  const scale = step.scale ?? { x: 1, y: 1 };
  const pivot = step.pivot ?? { x: 0.5, y: 0.5 };
  const x = pivot.x * rect.width,
    y = pivot.y * rect.height;
  const angle = (((step.rotationDeg ?? 0) % 360) * Math.PI) / 180;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const a = cosine * scale.x,
    b = sine * scale.x,
    c = -sine * scale.y,
    d = cosine * scale.y;
  const placement: Affine = [a, b, c, d, rect.x + x - a * x - c * y, rect.y + y - b * x - d * y];
  const pixelCenter = (start: number, length: number): [number, number] => {
    const first = Math.ceil(start - 0.5) + 0.5,
      last = Math.floor(start + length - 0.5) + 0.5;
    return first <= last ? [first, last] : [start + length / 2, start + length / 2];
  };
  const [left, right] = pixelCenter(source.x, source.width);
  const [bottom, top] = pixelCenter(input.height - source.y - source.height, source.height);
  const result: PicturePrimitive[] = [
    {
      kind: "clamp",
      x: left,
      y: bottom,
      width: Math.max(Number.EPSILON * Math.max(1, Math.abs(left)), right - left),
      height: Math.max(Number.EPSILON * Math.max(1, Math.abs(bottom)), top - bottom),
    },
  ];
  const pose = raster(placement, canvas.height, canvas.height);
  const fitted = multiply(centered, scaled);
  result.push(
    { kind: "affine", matrix: scaled },
    { kind: "affine", matrix: multiply(pose.matrix, centered) },
  );
  const box =
    fit === "cover"
      ? { x: 0, y: canvas.height - rect.height, width: rect.width, height: rect.height }
      : {
          x: fitted[0] * source.x + fitted[4],
          y: fitted[3] * (input.height - source.y - source.height) + fitted[5],
          width: source.width * sx,
          height: source.height * sy,
        };
  const [pa, pb, pc, pd, ptx, pty] = pose.matrix;
  const corners: [number, number][] = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ];
  const points = corners.map(([x, y]) => ({ x: pa * x + pc * y + ptx, y: pb * x + pd * y + pty }));
  result.push({ kind: "coverage", points, width: canvas.width, height: canvas.height });
  for (const operation of result)
    if (operation.kind === "affine")
      operation.matrix = operation.matrix.map((v) => (v === 0 ? 0 : v)) as Affine;
  if (
    result.some((op) =>
      (op.kind === "affine"
        ? op.matrix
        : op.kind === "coverage"
          ? op.points.flatMap(({ x, y }) => [x, y])
          : Object.values(op).filter((v) => typeof v === "number")
      ).some(
        (v) =>
          typeof v === "number" && (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER),
      ),
    )
  )
    throw new CompositionError(
      "INVALID_COMPOSITION",
      "Geometry exceeds finite execution precision",
    );
  return result;
}
