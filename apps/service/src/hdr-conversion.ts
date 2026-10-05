import type { HdrConversionFacts } from "@screenrec/core/hdr-conversion-facts";
import { CatalogError } from "@screenrec/core/catalog";
import type { FfmpegColorDeclarations } from "./ffmpeg-input.js";

/** Interpretation only. Physical support, clock mapping and actual derivative
 * validation remain separate requirements before any managed publication. */
export function qualifyHdrInterpretation(
  facts: HdrConversionFacts,
  color: FfmpegColorDeclarations,
) {
  const video = facts.video;
  const inspection = video.compressedVideoInspection;
  // Native owns packet/configuration grammar; this recipe consumes its whole-track verdict.
  if (
    video.codec !== "hvc1" ||
    video.hasAlpha ||
    video.codecAtomNames.length !== 1 ||
    video.codecAtomNames[0]!.length !== 1 ||
    video.codecAtomNames[0]![0] !== "hvcC" ||
    !inspection ||
    inspection.status !== "complete" ||
    inspection.refusals.length ||
    inspection.packetCount < video.samples.count
  )
    throw new CatalogError("UNSUPPORTED_MEDIA", "HDR compressed interpretation is unqualified");
  const declarations = facts.video.colorFormats;
  const native = declarations[0];
  const transfer = native?.transferFunction;
  const family =
    transfer === "SMPTE_ST_2084_PQ" ? "pq" : transfer === "ITU_R_2100_HLG" ? "hlg" : undefined;
  if (
    declarations.length !== 1 ||
    !native ||
    !family ||
    native.colorPrimaries !== "ITU_R_2020" ||
    native.ycbcrMatrix !== "ITU_R_2020" ||
    native.bitsPerComponent !== 10 ||
    native.fullRange === true ||
    native.interpretationExtensions.length ||
    native.invalidColorDeclarations.length ||
    color.colorPrimaries !== "bt2020" ||
    color.transferFunction !== (family === "pq" ? "smpte2084" : "arib-std-b67") ||
    color.ycbcrMatrix !== "bt2020nc" ||
    color.range !== "tv" ||
    color.pixelFormat !== "yuv420p10le"
  )
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "HDR source declarations are unqualified or disagree",
    );
  return { family };
}
