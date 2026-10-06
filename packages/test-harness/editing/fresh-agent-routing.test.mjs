import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { routeUseCase } from "../../../skills/yap/scripts/use-case-routing.mjs";

const references = new URL("../../../skills/yap/references/", import.meta.url).pathname;

test("fresh routing selects each focused use case and pins its reference", async () => {
  for (const useCase of ["launch", "podcast", "teaser"]) {
    const result = await routeUseCase({ useCase }, references);
    assert.equal(result.version, 1);
    assert.equal(result.useCase, useCase);
    assert.match(result.route.reference, new RegExp(`${useCase}-videos\\.md$`));
    assert.equal(result.policy.capabilityQuestionFirst, true);
    assert.equal(result.policy.externalCapabilitiesRecommendedOnlyWhenMateriallyRequired, true);
    assert.equal(result.policy.humanQaRequired, false);
    assert.match(result.provenance.focusedReference.sha256, /^[a-f0-9]{64}$/);
  }
});

test("fresh routing refuses an unknown use case", async () => {
  await assert.rejects(() => routeUseCase({ useCase: "tutorial" }, references), {
    code: "INVALID_REQUEST",
  });
});

test("fresh routing refuses an unlinked or incomplete reference", async () => {
  const root = await mkdtemp(join(tmpdir(), "yap-routing-"));
  try {
    await writeFile(join(root, "video-use-cases.md"), "# index\n");
    await writeFile(join(root, "launch-videos.md"), "# launch\n");
    await assert.rejects(() => routeUseCase({ useCase: "launch" }, root), {
      code: "REFERENCE_INVALID",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reference provenance is the actual installed skill bytes", async () => {
  const result = await routeUseCase({ useCase: "teaser" }, references);
  const bytes = await readFile(join(references, "teaser-videos.md"));
  assert.equal(result.provenance.focusedReference.bytes, bytes.length);
  assert.equal(result.provenance.focusedReference.sha256.length, 64);
});
