/** Authored stacks shared by native and public routes; expectations remain frozen PNGs. */
export function pointerCases() {
  const scenarios = [
    [
      "identity",
      [{ id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } }],
    ],
    [
      "translate",
      [
        {
          id: "move",
          enabled: true,
          processor: {
            type: "geometry",
            fit: "stretch",
            rect: { x: 32, y: 16, width: 256, height: 160 },
          },
        },
        { id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } },
      ],
    ],
    [
      "before-opacity",
      [
        { id: "fade", enabled: true, processor: { type: "opacity", opacity: 0.2 } },
        { id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } },
      ],
    ],
    [
      "after-opacity",
      [
        { id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } },
        { id: "fade", enabled: true, processor: { type: "opacity", opacity: 0.2 } },
      ],
    ],
  ];
  const pointer = { id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } };
  const crop = {
    id: "crop",
    enabled: true,
    processor: {
      type: "geometry",
      crop: { x: 80, y: 50, width: 64, height: 48 },
      fit: "stretch",
      rect: { x: 80, y: 50, width: 64, height: 48 },
    },
  };
  const turn = { id: "turn", enabled: true, processor: { type: "geometry", rotationDeg: 90 } };
  scenarios.push(
    ["crop-before-pointer", [crop, pointer]],
    ["pointer-before-crop", [pointer, crop]],
    ["rotate-before-pointer", [turn, pointer]],
    ["pointer-before-rotate", [pointer, turn]],
    ["disabled", [{ ...pointer, enabled: false }]],
  );
  return scenarios;
}
