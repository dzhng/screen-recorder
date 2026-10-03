import { CatalogError } from "./catalog.js";

export type RenderedMovie = {
  file: string;
  mediaType: "video/mp4";
  codec: "h264";
  durationUs: number;
  width: number;
  height: number;
  frameCount: number;
  bytes: number;
};

/** Refuse a renderer receipt that does not match the requested movie or rendition bound. */
export function checkRenderedMovie(
  movie: RenderedMovie,
  expected: { file: string; durationUs: number; maxLongEdge: number | null },
): void {
  if (
    movie.file !== expected.file ||
    movie.mediaType !== "video/mp4" ||
    movie.codec !== "h264" ||
    movie.durationUs !== expected.durationUs ||
    ![movie.width, movie.height, movie.frameCount, movie.bytes].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new CatalogError("INVALID_RESPONSE", "Renderer returned an unrelated preview");
  // The movie's own dimensions are the receipt: a bounded rendition is whatever the source scaled
  // down to, but it cannot be larger than what was asked for, nor an odd size H.264 cannot encode.
  if (
    expected.maxLongEdge !== null &&
    (Math.max(movie.width, movie.height) > expected.maxLongEdge ||
      movie.width % 2 !== 0 ||
      movie.height % 2 !== 0)
  )
    throw new CatalogError(
      "INVALID_RESPONSE",
      `Preview is ${movie.width}x${movie.height}, not the rendition bounded to ${expected.maxLongEdge}`,
    );
}
