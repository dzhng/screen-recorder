import { evidenceRecordingId } from "./evidence.js";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CatalogError } from "./catalog.js";
import {
  TimelineEventRead,
  timelineEventCursorSchema,
  timelineEventPolicy,
  type TimelineEventInput,
} from "./event-pages.js";

const text = z.string().min(1).max(256);
const referenceSchema = z.strictObject({
  target: z.unknown(),
  recordingId: text,
  sourceId: text,
  revisionId: text,
  sourceGeneration: text,
  sceneGeneration: text,
  scenePolicy: text,
  interrupted: z.boolean(),
  policy: z.literal(timelineEventPolicy),
});
const cursorSchema = z.strictObject({
  reference: referenceSchema,
  position: timelineEventCursorSchema,
});
export type TimelineContext<Target> = { target: Target; events: TimelineEventInput };
function reference<Target>(context: TimelineContext<Target>) {
  const { sourceIdentity, sceneIdentity, revision, interrupted } = context.events;
  return {
    target: context.target,
    recordingId: evidenceRecordingId(sourceIdentity),
    sourceId: sourceIdentity.sourceId,
    revisionId: revision.id,
    sourceGeneration: sourceIdentity.generation,
    sceneGeneration: sceneIdentity.generation,
    scenePolicy: sceneIdentity.policy,
    interrupted,
    policy: timelineEventPolicy,
  };
}
function decodeCursor(value: string) {
  try {
    if (value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    return cursorSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    throw new CatalogError("INVALID_PARAMS", "Invalid timeline continuation");
  }
}
/** Both adapters resolve authority again after awaited reads; continuations pin their selected revision. */
export abstract class TimelineInspection<Target extends object> {
  protected abstract resolve(
    input: Target & { revisionId?: string | undefined },
  ): TimelineContext<Target>;
  async get(
    input: Target & {
      revisionId?: string | undefined;
      cursor?: string | undefined;
      limit?: number | undefined;
    },
    signal?: AbortSignal,
  ) {
    const { revisionId, cursor: encodedCursor, limit, ...target } = input;
    const cursor = encodedCursor === undefined ? undefined : decodeCursor(encodedCursor);
    if (
      cursor &&
      (!isDeepStrictEqual(cursor.reference.target, target) ||
        (revisionId !== undefined && revisionId !== cursor.reference.revisionId))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Timeline continuation belongs to another target or revision",
      );
    const selected = { ...input, revisionId: revisionId ?? cursor?.reference.revisionId };
    const context = this.resolve(selected),
      identity = reference(context);
    if (cursor && !isDeepStrictEqual(cursor.reference, identity))
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Timeline continuation belongs to another target, revision or evidence generation",
      );
    const page = await new TimelineEventRead(context.events).page(
      { cursor: cursor?.position, limit },
      signal,
    );
    signal?.throwIfAborted();
    if (
      !isDeepStrictEqual(
        reference(this.resolve({ ...selected, revisionId: identity.revisionId })),
        identity,
      )
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Timeline evidence changed during read");
    const nextCursor =
      page.nextCursor === null
        ? null
        : Buffer.from(JSON.stringify({ reference: identity, position: page.nextCursor })).toString(
            "base64url",
          );
    if (nextCursor !== null && nextCursor.length > 4096)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Timeline continuation exceeds its bounded representation",
      );
    return {
      ...identity,
      state: "ready" as const,
      timeDomain: "playback" as const,
      rows: page.rows,
      nextCursor,
    };
  }
}
