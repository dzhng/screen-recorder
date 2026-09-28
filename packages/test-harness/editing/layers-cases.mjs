const geometry = (label, settings = {}) => ({
  label,
  processor: { type: "geometry", ...settings },
});
const opacity = (label, value) => ({ label, processor: { type: "opacity", opacity: value } });

export function layerCases(canvas) {
  const hidden = [opacity("hide-presenter", 0)];
  const layout = geometry("presenter-layout", {
    rect: { x: canvas.width - 40, y: 24, width: 32, height: 56 },
    fit: "stretch",
  });
  const first = geometry("first-layout", {
    rect: { x: 16, y: 0, width: 64, height: 48 },
    fit: "stretch",
  });
  const second = geometry("second-crop", {
    crop: { x: 16, y: 0, width: 32, height: 48 },
    rect: { x: 0, y: 0, width: 64, height: 96 },
    fit: "stretch",
  });
  const left = geometry("left-plate", {
    rect: { x: 8, y: 16, width: 64, height: 48 },
    fit: "stretch",
  });
  const right = geometry("right-plate", {
    rect: { x: 40, y: 32, width: 64, height: 48 },
    fit: "stretch",
  });
  return [
    { name: "baseline", stacks: { presenter: hidden } },
    { name: "explicit-default", stacks: { presenter: hidden, screen: [geometry("default")] } },
    {
      name: "full-domain-crop",
      sources: { screen: "plate" },
      stacks: {
        presenter: hidden,
        screen: [geometry("full", { crop: { x: 0, y: 0, width: 16, height: 16 } })],
      },
    },
    {
      name: "negative-crop",
      stacks: {
        presenter: hidden,
        screen: [geometry("outside", { crop: { x: -8, y: -6, width: 80, height: 60 } })],
      },
    },
    {
      name: "fractional-crop",
      stacks: {
        presenter: hidden,
        screen: [
          geometry("fractional", {
            crop: { x: 4.25, y: 4.25, width: 31.5, height: 23.5 },
            rect: { x: 16.25, y: 8.75, width: 63, height: 47 },
            fit: "stretch",
          }),
        ],
      },
    },
    {
      name: "poison-exclusion",
      stacks: {
        presenter: hidden,
        screen: [
          geometry("poison", {
            crop: { x: 12, y: 4, width: 32, height: 24 },
            rect: { x: 16, y: 8, width: 96, height: 72 },
            fit: "stretch",
          }),
        ],
      },
    },
    {
      name: "rotated-crop",
      stacks: {
        presenter: hidden,
        screen: [
          geometry("rotated", {
            crop: { x: 4, y: 4, width: 32, height: 24 },
            rect: { x: 48, y: 24, width: 64, height: 48 },
            fit: "stretch",
            rotationDeg: 33,
          }),
        ],
      },
    },
    { name: "source-orientation", sources: { screen: "rotated" }, stacks: { presenter: hidden } },
    { name: "presenter", stacks: { presenter: [layout] } },
    { name: "presenter-reversed", stacks: { presenter: [layout], reversed: true } },
    {
      name: "source-crop",
      stacks: {
        presenter: hidden,
        screen: [
          geometry("crop", {
            crop: { x: 4, y: 4, width: 32, height: 24 },
            rect: { x: 16, y: 8, width: 64, height: 48 },
            fit: "stretch",
          }),
        ],
      },
    },
    ...["contain", "cover", "stretch"].map((fit) => ({
      name: fit,
      stacks: {
        presenter: hidden,
        screen: [geometry("fit", { rect: { x: 16, y: 8, width: 80, height: 80 }, fit })],
      },
    })),
    ...[
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
    ].map((pivot, index) => ({
      name: `pivot-${index}`,
      stacks: {
        presenter: hidden,
        screen: [
          geometry("turn", {
            rect: { x: 64, y: 8, width: 64, height: 48 },
            rotationDeg: 90,
            pivot,
          }),
        ],
      },
    })),
    {
      name: "mirror",
      stacks: { presenter: hidden, screen: [geometry("mirror", { scale: { x: -1, y: 1 } })] },
    },
    {
      name: "collapse",
      stacks: { presenter: hidden, screen: [geometry("collapse", { scale: { x: 0, y: 1 } })] },
    },
    { name: "order-placement-crop", stacks: { presenter: hidden, screen: [first, second] } },
    { name: "order-crop-placement", stacks: { presenter: hidden, screen: [second, first] } },
    {
      name: "parent-opacity",
      sources: { screen: "plate", presenter: "plate" },
      stacks: {
        screen: [left],
        presenter: [right],
        inner: [opacity("parent-half", 0.5)],
      },
    },
    {
      name: "child-opacity",
      sources: { screen: "plate", presenter: "plate" },
      stacks: {
        screen: [left, opacity("left-half", 0.5)],
        presenter: [right, opacity("right-half", 0.5)],
      },
    },
    {
      name: "nested-taps",
      taps: true,
      movie: "nonopaque",
      stacks: {
        screen: [geometry("screen-place"), opacity("screen-opacity", 0.75)],
        presenter: [layout, opacity("presenter-opacity", 0.5)],
        screenTrack: [opacity("screen-track-opacity", 0.75)],
        presenterTrack: [opacity("presenter-track-opacity", 0.75)],
        inner: [opacity("inner-opacity", 0.5)],
        outer: [opacity("outer-opacity", 0.75)],
        output: [opacity("output-opacity", 0.75)],
      },
    },
    {
      name: "output-mirror",
      stacks: {
        presenter: [layout],
        output: [geometry("output-mirror", { scale: { x: -1, y: 1 } })],
      },
    },
    {
      name: "output-transparent-margin",
      movie: "nonopaque",
      stacks: {
        presenter: hidden,
        output: [
          geometry("output-inset", {
            rect: { x: 8, y: 8, width: canvas.width - 16, height: canvas.height - 16 },
          }),
        ],
      },
    },
  ];
}
