import assert from "node:assert/strict";

/**
 * Public composition checkpoint for styled captions. One frame contains a
 * selected matrix of native text styles so receipt fields and rendered pixels
 * are observed through the same frame.get boundary callers use.
 */
export async function styledCaptionSheet({ project, picture, font, report }) {
  const p = await project({
    width: 640,
    height: 420,
    fps: { numerator: 8, denominator: 1 },
    background: "#142032ff",
  });
  const variants = [
    {
      label: "top-plain",
      text: "Top aligned",
      verticalAlignment: undefined,
      expected: { stroke: undefined, shadow: undefined, background: undefined },
      rect: { x: 20, y: 20 },
    },
    {
      label: "center-stroke",
      text: "Center stroke",
      verticalAlignment: "center",
      stroke: { color: "#ff5c35ff", width: 4 },
      expected: {
        stroke: { color: "#ff5c35ff", width: 4 },
        shadow: undefined,
        background: undefined,
      },
      rect: { x: 340, y: 20 },
    },
    {
      label: "bottom-shadow",
      text: "Bottom shadow",
      verticalAlignment: "bottom",
      shadow: { color: "#000000cc", offsetX: 6, offsetY: 8, blur: 5 },
      expected: {
        stroke: undefined,
        shadow: { color: "#000000cc", offsetX: 6, offsetY: 8, blur: 5 },
        background: undefined,
      },
      rect: { x: 20, y: 240 },
    },
    {
      label: "center-background",
      text: "Center background",
      verticalAlignment: "center",
      background: { color: "#112233dd", padding: 12, cornerRadius: 8 },
      expected: {
        stroke: undefined,
        shadow: undefined,
        background: { color: "#112233dd", padding: 12, cornerRadius: 8 },
      },
      rect: { x: 340, y: 240 },
    },
  ];
  const style = (variant) => ({
    kind: "text",
    text: variant.text,
    font: { assetId: font.id, postScriptName: "ArialMT" },
    width: 280,
    height: 150,
    size: 32,
    color: "#ffffffff",
    alignment: "center",
    ...(variant.verticalAlignment ? { verticalAlignment: variant.verticalAlignment } : {}),
    ...(variant.stroke ? { stroke: variant.stroke } : {}),
    ...(variant.shadow ? { shadow: variant.shadow } : {}),
    ...(variant.background ? { background: variant.background } : {}),
    wrap: true,
  });
  const operations = [
    ...variants.map((variant, order) => ({
      operation: "track.add",
      label: variant.label,
      track: { kind: "video", order },
    })),
    ...variants.map((variant) => ({
      operation: "place",
      label: `${variant.label}-text`,
      clip: {
        trackId: { label: variant.label },
        source: style(variant),
        placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
    })),
  ];
  const placed = await p.edit(operations);
  await p.edit(
    variants.map((variant) => ({
      operation: "processing.set",
      target: { kind: "clip", id: placed.edit.labels[`${variant.label}-text`] },
      steps: [
        {
          processor: {
            type: "geometry",
            crop: { x: 0, y: 0, width: 280, height: 150 },
            rect: { x: variant.rect.x, y: variant.rect.y, width: 280, height: 150 },
            fit: "contain",
            scale: { x: 1, y: 1 },
            rotationDeg: 0,
            pivot: { x: 0.5, y: 0.5 },
          },
        },
      ],
    })),
  );
  const sheet = await picture({ ...p.selection(), atUs: 500000 }, "styled-caption-sheet");
  const byClip = new Map(sheet.receipt.pictures.map((entry) => [entry.clipId, entry]));
  const rows = variants.map((variant) => {
    const clipId = placed.edit.labels[`${variant.label}-text`];
    const entry = byClip.get(clipId);
    assert.ok(entry && entry.kind === "text" && entry.status === "available", variant.label);
    assert.equal(entry.layout.text, variant.text);
    assert.deepEqual(
      {
        stroke: entry.layout.stroke,
        shadow: entry.layout.shadow,
        background: entry.layout.background,
      },
      variant.expected,
    );
    assert.ok(entry.layout.decorationBounds[2] >= entry.layout.inkBounds[2]);
    assert.ok(entry.layout.decorationBounds[3] >= entry.layout.inkBounds[3]);
    return {
      label: variant.label,
      clipId,
      ...(variant.verticalAlignment ? { verticalAlignment: variant.verticalAlignment } : {}),
      verticalOffset: entry.layout.verticalOffset,
      inkBounds: entry.layout.inkBounds,
      decorationBounds: entry.layout.decorationBounds,
      style: variant.expected,
    };
  });
  assert.equal(new Set(rows.map((row) => row.clipId)).size, variants.length);
  assert.ok(rows[0].verticalOffset < rows[1].verticalOffset);
  assert.ok(rows[1].verticalOffset < rows[2].verticalOffset);
  report.checks.push({
    name: "public-styled-caption-static-sheet",
    frame: sheet.receipt,
    rows,
    exactStyleReceipts: true,
    decorationBoundsContainInk: true,
    verticalPlacementOrdered: true,
  });
  return { projectId: p.selection().projectId, revisionId: p.selection().revisionId, sheet };
}
