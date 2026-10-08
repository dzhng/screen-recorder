import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const source = new URL("../Sources/Yap/SkillManager.swift", import.meta.url).pathname;

test("skill status discovers every global harness destination", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-skill-status-"));
  try {
    const home = join(scratch, "home");
    const bin = join(scratch, "bin");
    mkdirSync(join(home, ".agents/skills/yap"), { recursive: true });
    writeFileSync(join(home, ".agents/skills/yap/SKILL.md"), "skill\n");
    mkdirSync(join(home, ".codex/skills"), { recursive: true });
    mkdirSync(join(home, ".claude/skills"), { recursive: true });
    symlinkSync("../../.agents/skills/yap", join(home, ".codex/skills/yap"));
    symlinkSync("../../.agents/skills/yap", join(home, ".claude/skills/yap"));
    mkdirSync(bin, { recursive: true });
    const fake = join(bin, "npx");
    writeFileSync(fake, `#!/bin/sh
printf '[{"name":"yap","path":"%s/.agents/skills/yap","scope":"global","agents":["Codex"]},{"name":"yap","path":"%s/.codex/skills/yap","scope":"global","agents":["Codex"]},{"name":"yap","path":"%s/.claude/skills/yap","scope":"global","agents":["Claude Code"]}]' "$HOME" "$HOME" "$HOME"
`);
    chmodSync(fake, 0o755);
    const stub = join(scratch, "Stub.swift");
    writeFileSync(stub, `import Foundation
struct ServiceFailure: Error { let code: String; let message: String }
@MainActor protocol SkillLifecycle { func perform(_ operation: String) }
@main struct Check {
  @MainActor static func main() throws {
    let manager = SkillManager(home: CommandLine.arguments[1])
    let data = try manager.handle("skill.status").get()
    let object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    precondition(object["state"] as? String == "unmanaged")
    precondition((object["paths"] as! [String]).count == 3)
    precondition((object["destinations"] as! [[String: Any]]).allSatisfy { $0["exists"] as? Bool == true })
    print("PASS skill status discovery")
  }
}
`);
    const executable = join(scratch, "check");
    execFileSync("swiftc", ["-swift-version", "6", "-parse-as-library", source, stub, "-o", executable], { stdio: "pipe" });
    const output = execFileSync(executable, [home], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
      timeout: 120_000,
    });
    assert.match(output, /PASS skill status discovery/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
