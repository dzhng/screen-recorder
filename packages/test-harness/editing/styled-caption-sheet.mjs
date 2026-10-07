import assert from "node:assert/strict";

/**
 * Public composition checkpoint for styled captions. One frame contains a
 * selected matrix of native text styles so receipt fields and rendered pixels
 * are observed through the same frame.get boundary callers use.
 */
export async function styledCaptionSheet({ project, picture, font, report, rgba }) {
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
      shadow: { color: "#8abcf0cc", offsetX: 2, offsetY: -4, blur: 2 },
      expected: {
        stroke: undefined,
        shadow: { color: "#8abcf0cc", offsetX: 2, offsetY: -4, blur: 2 },
        background: undefined,
      },
      rect: { x: 20, y: 240 },
    },
    {
      label: "center-background",
      text: "Background",
      verticalAlignment: "center",
      background: { color: "#36506ddd", padding: 12, cornerRadius: 8 },
      expected: {
        stroke: undefined,
        shadow: undefined,
        background: { color: "#36506ddd", padding: 12, cornerRadius: 8 },
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
        source: { ...style(variant), stroke: undefined, shadow: undefined, background: undefined },
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
  const plain = await picture({ ...p.selection(), atUs: 500000 }, "plain-caption-sheet");
  await p.edit(
    variants.map((variant) => ({
      operation: "text.set",
      clipId: placed.edit.labels[`${variant.label}-text`],
      source: style(variant),
    })),
  );
  const sheet = await picture({ ...p.selection(), atUs: 500000 }, "styled-caption-sheet");
  assert.notDeepEqual(sheet.bytes, plain.bytes, "Decorations must change delivered PNG bytes");
  const plainPixels = await rgba(plain.path);
  const styledPixels = await rgba(sheet.path);
  assert.equal(plainPixels.length, 640 * 420 * 4);
  assert.equal(styledPixels.length, plainPixels.length);
  const plainByClip = new Map(plain.receipt.pictures.map((entry) => [entry.clipId, entry]));
  const byClip = new Map(sheet.receipt.pictures.map((entry) => [entry.clipId, entry]));
  const rows = variants.map((variant) => {
    const clipId = placed.edit.labels[`${variant.label}-text`];
    const entry = byClip.get(clipId);
    assert.ok(entry && entry.kind === "text" && entry.status === "available", variant.label);
    assert.equal(entry.layout.text, variant.text);
    assert.deepEqual(entry.layout.inkBounds, plainByClip.get(clipId).layout.inkBounds);
    assert.deepEqual(
      {
        stroke: entry.layout.stroke,
        shadow: entry.layout.shadow,
        background: entry.layout.background,
      },
      variant.expected,
    );
    const [x, y, width, height] = entry.layout.decorationBounds;
    const [inkX, inkY, inkWidth, inkHeight] = entry.layout.inkBounds;
    assert.ok(x <= inkX && y <= inkY);
    assert.ok(x + width >= inkX + inkWidth && y + height >= inkY + inkHeight);
    if (variant.verticalAlignment === "center")
      assert.ok(Math.abs(inkY + inkHeight / 2 - 75) < 1, variant.label);
    if (variant.verticalAlignment === "bottom")
      assert.ok(Math.abs(inkY + inkHeight - 150) < 1, variant.label);
    if (variant.verticalAlignment === undefined) assert.equal(entry.layout.verticalOffset, 0);
    return {
      label: variant.label,
      clipId,
      ...(variant.verticalAlignment ? { verticalAlignment: variant.verticalAlignment } : {}),
      verticalOffset: entry.layout.verticalOffset,
      inkBounds: entry.layout.inkBounds,
      decorationBounds: entry.layout.decorationBounds,
      decorationClipped: x < 0 || y < 0 || x + width > 280 || y + height > 150,
      style: variant.expected,
    };
  });
  assert.equal(new Set(rows.map((row) => row.clipId)).size, variants.length);
  assert.ok(rows[0].inkBounds[1] < rows[1].inkBounds[1]);
  assert.ok(rows[1].inkBounds[1] < rows[2].inkBounds[1]);
  const pixelChanges = variants.map((variant) => {
    let changedPixels = 0;
    for (let y = variant.rect.y; y < variant.rect.y + 150; y++)
      for (let x = variant.rect.x; x < variant.rect.x + 280; x++) {
        const index = (y * 640 + x) * 4;
        if (!plainPixels.subarray(index, index + 4).equals(styledPixels.subarray(index, index + 4)))
          changedPixels++;
      }
    assert.ok(
      variant.label === "top-plain" ? changedPixels === 0 : changedPixels > 0,
      variant.label,
    );
    return { label: variant.label, changedPixels };
  });
  report.checks.push({
    name: "public-styled-caption-static-sheet",
    frame: sheet.receipt,
    rows,
    exactStyleReceipts: true,
    decorationBoundsContainInk: true,
    verticalPlacementOrdered: true,
    plainReference: plain.receipt,
    glyphPlacementUnchangedByDecorations: true,
    pixelChanges,
  });
  return { projectId: p.selection().projectId, revisionId: p.selection().revisionId, sheet };
}
