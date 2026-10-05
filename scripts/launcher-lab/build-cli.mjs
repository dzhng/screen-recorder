import { join } from "node:path";
const [root, outfile] = process.argv.slice(2);
const result = await Bun.build({
  entrypoints: [join(root, "apps/cli/src/main.ts")],
  target: "node",
  plugins: [
    {
      name: "workspace-source",
      setup(build) {
        build.onResolve({ filter: /^@screenrec\/(client|protocol|composition)$/ }, ({ path }) => ({
          path: join(root, "packages", path.slice("@screenrec/".length), "src/index.ts"),
        }));
      },
    },
  ],
});
if (!result.success) throw new AggregateError(result.logs, "CLI bundling failed");
await Bun.write(outfile, result.outputs[0]);
