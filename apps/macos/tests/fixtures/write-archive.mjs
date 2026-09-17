import { chmod, mkdir, open, readFile, writeFile, rm } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { fileIdentity } from "@screenrec/core/files";
import { writeArchive } from "../../../service/dist/archive-write.js";
import { Publication } from "../../../service/dist/publication.js";

/** Generated fixture assembly; production prerequisite selection remains a separate gate. */
export async function writeArchiveFixture(directory, destination, worker) {
  const parent = dirname(destination),
    scratch = join(parent, "zip-scratch"),
    stage = join(parent, "zip-publication");
  await chmod(directory, 0o700);
  await mkdir(scratch, { mode: 0o700 });
  await mkdir(stage, { mode: 0o700 });
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const members = [];
  for (const path of [...manifest.inventory.map((entry) => entry.path), "manifest.json"]) {
    const file = await open(join(directory, path));
    try {
      const info = await file.stat({ bigint: true });
      const value = await file.readFile();
      members.push({
        path,
        bytes: Number(info.size),
        identity: fileIdentity(info),
        sha256: createHash("sha256").update(value).digest("hex"),
      });
    } finally {
      await file.close();
    }
  }
  const planPath = join(parent, "zip-plan.json");
  await writeFile(planPath, JSON.stringify(members));
  const input = await open(directory),
    plan = await open(planPath),
    output = await open(scratch);
  let zip, publication;
  try {
    zip = await writeArchive(
      { handle: input, plan, bytes: members.reduce((sum, member) => sum + member.bytes, 0) },
      { directory: scratch, handle: output },
      worker,
    );
    publication = await Publication.open(stage, parent, worker);
    await publication.prepare(zip.file, basename(destination), zip.receipt.bytes);
    const committed = await publication.commit();
    if (committed.state !== "committed") throw new Error("Generated ZIP publication failed");
    await publication.acknowledge();
    return zip.receipt;
  } finally {
    await publication?.close();
    await zip?.close();
    await input.close();
    await plan.close();
    await output.close();
    await rm(planPath);
    await rm(scratch, { recursive: true });
    await rm(stage, { recursive: true });
  }
}
