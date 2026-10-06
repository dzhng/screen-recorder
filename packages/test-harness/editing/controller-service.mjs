import { startProjectService } from "../../../apps/service/dist/project-service.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
import { access, appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// The actual private channel and project service share the production app host's pipes.
const native = mediaWorker();
const evidence = process.env.YAP_CONTROLLER_EVIDENCE;
const hold = process.env.YAP_CONTROLLER_RECOVERY_HOLD
  ? JSON.parse(await readFile(process.env.YAP_CONTROLLER_RECOVERY_HOLD, "utf8"))
  : null;
const fault = process.env.YAP_CONTROLLER_IMPORT_FAULT
  ? JSON.parse(await readFile(process.env.YAP_CONTROLLER_IMPORT_FAULT, "utf8"))
  : null;
let ordinal = 0;
const worker = async (operation, params, options) => {
  const original = params;
  let replacement;
  if (fault && operation === "media.sourceEvidence" && params.sourceAuthority) {
    params = structuredClone(params);
    const authorityFile = join(params.directory, "source.publication.json");
    if (fault.mode === "omit-receipt") await rm(authorityFile);
    else if (fault.mode === "alter-private-proof") {
      const receipt = JSON.parse(await readFile(authorityFile, "utf8"));
      assert.ok(receipt.recovery);
      delete receipt.recovery;
      await writeFile(authorityFile, JSON.stringify(receipt));
    } else if (fault.mode === "alter-journal-tail")
      await appendFile(join(params.directory, "capture.journal.jsonl"), "untrusted tail\n");
    else if (fault.mode === "substitute-canonical") {
      replacement = await open(fault.video, "r");
      const index = Number(params.canonical.video.split("/").at(-1)) - 3;
      assert.ok(Number.isSafeInteger(index) && index >= 0 && index < options.descriptors.length);
      const descriptors = [...options.descriptors];
      descriptors[index] = replacement.fd;
      options = { ...options, descriptors };
    } else throw new Error("Unknown capture import fault");
  }
  const prefix = evidence ? join(evidence, `${ordinal++}-${operation}`) : null;
  if (prefix) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      prefix + "-request.json",
      JSON.stringify(
        {
          operation,
          params,
          ...(params === original ? {} : { fixtureFault: fault, originalParams: original }),
        },
        null,
        2,
      ),
    );
  }
  let response;
  try {
    response = await native(operation, params, options);
  } finally {
    await replacement?.close();
  }
  if (prefix) await writeFile(prefix + "-response.json", JSON.stringify(response, null, 2));
  if (hold && operation === "media.recover" && params.sourceAuthority?.kind === hold.kind) {
    await writeFile(
      join(hold.directory, "entered.json"),
      JSON.stringify({ operation, params, response }, null, 2),
    );
    const deadline = performance.now() + 120000;
    while (
      !(await access(join(hold.directory, "release")).then(
        () => true,
        () => false,
      ))
    ) {
      if (performance.now() >= deadline) throw new Error("Recovery reply fixture deadline");
      await delay(20, undefined, { signal: options.signal });
    }
  }
  return response;
};
await startProjectService({
  home: process.env.YAP_CONTROLLER_HOME,
  worker,
  control: { input: process.stdin, output: process.stdout },
});
