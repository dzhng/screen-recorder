import { fstatSync } from "node:fs";
import { mediaProbeSchema, type MediaProbe } from "@screenrec/core/assets";
import { CatalogError } from "@screenrec/core/catalog";
import type { OpenedFile } from "@screenrec/core/files";
import { cliWorker, nativeResult } from "./worker.js";

// Self-contained demuxers only. These are execution families, never media admission.
const demuxers = "mov,matroska,webm,wav,aiff,caf,aac,mp3,flac,ogg,avi";
const inputArguments = [
  "-protocol_whitelist",
  "fd",
  "-format_whitelist",
  demuxers,
  "-fd",
  "3",
  "-i",
  "fd:",
];
type ProbeStream = { index: number; id?: string; codec_type: string };
function streams(value: unknown): ProbeStream[] {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { streams?: unknown }).streams)
  )
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "FFprobe omitted stream selectors");
  const rows = (value as { streams: unknown[] }).streams;
  if (!rows.length || rows.length > 256)
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "FFprobe stream selector count is invalid");
  const result: ProbeStream[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object")
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "FFprobe stream selector is invalid");
    const item = row as Record<string, unknown>;
    if (
      !Number.isSafeInteger(item.index) ||
      (item.index as number) < 0 ||
      typeof item.codec_type !== "string" ||
      (item.id !== undefined &&
        (typeof item.id !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(item.id)))
    )
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "FFprobe stream selector is invalid");
    result.push({
      index: item.index as number,
      codec_type: item.codec_type,
      ...(item.id === undefined ? {} : { id: item.id as string }),
    });
  }
  if (new Set(result.map((row) => row.index)).size !== result.length)
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "FFprobe repeated a stream selector");
  return result;
}

/** Borrow one already-admitted regular file. Native owns support/timing; FFprobe
 * supplies only the selector needed to execute that explicit stream on held bytes.
 * The caller keeps this distinct read lease alive until every FFmpeg task retires. */
export async function inspectFfmpegInput(
  command: { executable: string; ownerExecutable: string },
  input: {
    file: Pick<OpenedFile, "fd">;
    metadata: MediaProbe;
    streamId: string;
    signal?: AbortSignal;
    lifetimes?: readonly number[];
  },
) {
  input.signal?.throwIfAborted();
  const stat = fstatSync(input.file.fd);
  if (!stat.isFile())
    throw new CatalogError("UNSUPPORTED_MEDIA", "FFmpeg input must be a retained regular file");
  const metadata = mediaProbeSchema.parse(input.metadata);
  const stream = metadata.streams.find((row) => row.id === input.streamId);
  if (!stream || !stream.decodable || (stream.kind !== "audio" && stream.kind !== "video"))
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "Requested native stream is not supported for FFmpeg execution",
    );
  if (stream.kind === "audio" && stream.channels !== 1 && stream.channels !== 2)
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "FFmpeg audio execution supports mono or stereo only",
    );
  const descriptors = [input.file.fd, ...(input.lifetimes ?? [])];
  const receipt = nativeResult(
    await cliWorker(
      {
        ...command,
        args: [
          "-v",
          "error",
          ...inputArguments,
          "-show_entries",
          "stream=index,id,codec_type",
          "-of",
          "json",
        ],
      },
      {
        descriptors,
        rewindDescriptors: [3],
        output: "json",
        maxBytes: 262144,
        ...(input.signal ? { signal: input.signal } : {}),
      },
    ),
  ) as { output: unknown };
  const candidates = streams(receipt.output).filter((row) => row.codec_type === stream.kind);
  const track = /^track:([1-9][0-9]*)$/.exec(stream.id);
  const matches = track
    ? candidates.filter((row) => row.id !== undefined && BigInt(row.id) === BigInt(track[1]!))
    : [];
  const selected =
    matches.length === 1
      ? matches[0]
      : matches.length === 0 &&
          candidates.length === 1 &&
          candidates[0]!.id === undefined &&
          metadata.streams.filter((row) => row.kind === stream.kind).length === 1
        ? candidates[0]
        : undefined;
  if (!selected)
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "Native stream cannot be bound unambiguously to FFmpeg",
    );
  return {
    descriptors,
    rewindDescriptors: [3],
    args: ["-copyts", "-noautorotate", ...inputArguments],
    map: `0:${selected.index}`,
    originUs: metadata.originUs,
    stream,
  };
}
