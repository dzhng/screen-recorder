import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startPublicService, until } from "./fixtures/public-service.mjs";

/**
 * A relocated package plays the edit it carries.
 *
 * Its library was removed before this runs, so a movie that decodes at all was rendered from the
 * archive's own media. What it has to be is the pinned revision's own length at the preview bound,
 * delivered through the same lease a recording's preview uses, and the same movie when it is asked
 * for twice rather than a second render.
 */
export async function publicPreview(root, output, executable, archive) {
  const context = JSON.parse(await readFile(join(root, "context.json"), "utf8"));
  const home = await mkdtemp("/tmp/scr-public-preview-");
  const service = await startPublicService(home, executable);
  try {
    const ok = async (operation, params = {}) => {
      const result = await service.call(operation, params);
      assert.equal(result.ok, true, `${operation}: ${JSON.stringify(result)}`);
      return result.data;
    };
    const admitted = await ok("package.open", { path: await realpath(archive) });
    const opened = await until(async () => {
      const state = await ok("package.status", { admissionId: admitted.id });
      assert.ok(!["failed", "cleanup_failed"].includes(state.state), JSON.stringify(state));
      return state.state === "ready" && state;
    }, "Package preview admission did not finish");
    const target = { packageHandle: opened.packageHandle };

    const ready = await until(async () => {
      const value = await ok("preview.get", target);
      assert.ok(!["failed", "unavailable"].includes(value.state), JSON.stringify(value));
      return value.state === "ready" && value;
    }, "Package preview did not finish");
    const movie = ready.published.preview;
    assert.equal(movie.revisionId, context.snapshot.revisionId, "A preview pins its revision");
    assert.equal(movie.recordingId, context.snapshot.recordingId);
    assert.equal(movie.maxLongEdge, 1600, "A package preview is the bounded rendition");
    assert.ok(
      Math.max(movie.width, movie.height) <= 1600 && movie.width % 2 === 0,
      `Rendition is ${movie.width}x${movie.height}`,
    );

    // The bytes arrive through the ordinary lease and decode as a movie of the edit's own length.
    const parts = [];
    let offset = 0;
    for (;;) {
      const chunk = await ok("artifact.read", {
        token: ready.delivery.token,
        offset,
        maxBytes: 524_288,
      });
      parts.push(Buffer.from(chunk.data, "base64"));
      if (chunk.eof) break;
      assert.ok(chunk.nextOffset > offset, "A read must make progress");
      offset = chunk.nextOffset;
    }
    await ok("artifact.close", { token: ready.delivery.token });
    const bytes = Buffer.concat(parts);
    assert.equal(bytes.length, movie.bytes, "Delivered bytes match the receipt");
    const file = join(output, "package-preview.mp4");
    await writeFile(file, bytes);
    const seconds = Number(
      execFileSync(
        "ffprobe",
        // prettier-ignore
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
        { encoding: "utf8" },
      ).trim(),
    );
    assert.ok(
      Math.abs(seconds - movie.durationUs / 1_000_000) < 0.25,
      `Decoded ${seconds}s against a receipt of ${movie.durationUs / 1_000_000}s`,
    );

    const again = await ok("preview.get", target);
    assert.equal(
      again.published.preview.cacheId,
      movie.cacheId,
      "Asking twice reuses the movie rather than rendering a second one",
    );
    await ok("artifact.close", { token: again.delivery.token });
    await ok("package.close", { admissionId: admitted.id });
    return {
      packagePreview: {
        durationUs: movie.durationUs,
        width: movie.width,
        height: movie.height,
        bytes: movie.bytes,
        maxLongEdge: movie.maxLongEdge,
        missingRoles: movie.missingRoles,
        decodedSeconds: seconds,
      },
    };
  } finally {
    await service.close();
    await rm(home, { recursive: true, force: true });
  }
}
