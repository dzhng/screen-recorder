// Research executes current source contracts without producing/shared package builds.
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const aliases = {
  "@screenrec/composition": root + "packages/composition/src/index.ts",
  "@screenrec/protocol": root + "packages/protocol/src/index.ts",
  zod: join(dirname(realpathSync(root + "node_modules")), "packages/core/node_modules/zod/index.js"),
};
registerHooks({
  resolve(specifier, context, next) {
    const mapped = aliases[specifier] ?? (specifier.startsWith("@screenrec/core/")
      ? root + "packages/core/src/" + specifier.slice("@screenrec/core/".length) + ".ts" : null);
    if (mapped) return { url: pathToFileURL(mapped).href, shortCircuit: true };
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL?.startsWith("file:")) {
      const url = new URL(specifier, context.parentURL);
      if (fileURLToPath(url).startsWith(root) && !existsSync(url)) {
        const source = new URL(url.href.replace(/\.js$/, ".ts"));
        if (existsSync(source)) return { url: source.href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".ts") && fileURLToPath(url).startsWith(root)) {
      const source = stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), {mode:"transform",sourceUrl:url});
      return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});
