export function secondsToSourceUs(seconds, binding) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > binding.frames / binding.sampleRate)
    throw new Error("Position must be within the original clip");
  return binding.sourceRange.startUs + Math.round(seconds * 1000000);
}

function knownFields(value, keys) {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new Error(`Unknown field: ${key}`);
}

export function buildAnnotationRecord(context, submitted) {
  knownFields(submitted, ["binding", "confirmed", "notes", "marks"]);
  const expected = context.binding,
    actual = submitted.binding;
  const bindingKeys = [
    "clipSha256",
    "sourceSha256",
    "sourceOriginUs",
    "sampleRate",
    "frames",
    "packetSha256",
  ];
  knownFields(actual, [...bindingKeys, "sourceRange"]);
  knownFields(actual.sourceRange, ["startUs", "endUs"]);
  for (const key of bindingKeys)
    if (actual?.[key] !== expected[key])
      throw new Error("Marks belong to a different source packet");
  if (
    actual?.sourceRange?.startUs !== expected.sourceRange.startUs ||
    actual?.sourceRange?.endUs !== expected.sourceRange.endUs
  )
    throw new Error("Marks belong to a different source clock");
  if (
    typeof submitted.confirmed !== "boolean" ||
    typeof submitted.notes !== "string" ||
    submitted.notes.length > 4096
  )
    throw new Error("Provide a listening confirmation and bounded notes");
  const seen = new Set();
  const marks = submitted.marks.map((mark) => {
    knownFields(mark, ["id", "startSeconds", "endSeconds"]);
    const target = context.targets.find((value) => value.id === mark.id);
    if (!target || seen.has(mark.id)) throw new Error("Unknown or duplicate marking target");
    seen.add(mark.id);
    const startUs =
      mark.startSeconds === null ? null : secondsToSourceUs(mark.startSeconds, expected);
    const endUs = mark.endSeconds === null ? null : secondsToSourceUs(mark.endSeconds, expected);
    if (startUs !== null && endUs !== null && endUs <= startUs)
      throw new Error("End must follow start");
    return {
      id: mark.id,
      text: target.text,
      startSeconds: mark.startSeconds,
      endSeconds: mark.endSeconds,
      startUs,
      endUs,
      sourceRange: startUs !== null && endUs !== null ? { startUs, endUs } : null,
    };
  });
  const range = (id) => marks.find((mark) => mark.id === id)?.sourceRange ?? null;
  const fillers = context.targets
    .filter((target) => target.kind === "filler" && range(target.id))
    .map((target) => ({
      id: target.inventoryId,
      kind: "filler",
      text: target.text,
      sourceRange: range(target.id),
    }));
  return {
    binding: structuredClone(expected),
    review: {
      authority: submitted.confirmed ? "human listening confirmation" : "unconfirmed draft",
      notes: submitted.notes,
    },
    marks,
    independentAnnotations: submitted.confirmed
      ? {
          independentSentenceRange: range("sentence"),
          protectedNeighbors: [
            { wordId: "w116", text: "paragraph", independentRange: range("w116") },
            { wordId: "w118", text: "this", independentRange: range("w118") },
          ],
          independentFillerInventory: fillers.length
            ? {
                scope: structuredClone(expected.sourceRange),
                complete: false,
                targets: fillers,
              }
            : null,
          independentRepetitionIntent: null,
        }
      : null,
  };
}
