import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";
test("audio exports decode standalone destinations and expose shared status controls without opening a panel", () => {
  const scratch = mkdtempSync(join(tmpdir(), "sr-audio-controls-"));
  try {
    const executable = compileControlsCheck(
      scratch,
      [],
      String.raw`
import Foundation
import ScreenRecorderControls
@main struct Check {
 static func main() throws {
  for leaf in ["mix.wav","mix.m4a"] {
   let fields:[String:Any] = ["exportId":"audio-"+leaf,"projectId":"p","kind":"audio","snapshot":["revisionId":"r","settings":["container":leaf.hasSuffix("wav") ? "wav":"m4a"]],"state":"failed","destination":["directory":"/tmp","leaf":leaf],"retryable":true,"abandoning":false,"cleanupPending":false,"output":NSNull(),"reason":"fixture failure"]
   let data=try JSONSerialization.data(withJSONObject:fields)
   let record=try JSONDecoder().decode(ExportsState.Record.self,from:data)
   precondition(record.kind == .audio && record.leaf == leaf && record.target == .project("p"))
   var exports=ExportsState();exports.admit(record)
   var state=ControlsState();state.service = .ready
   let menu=RecordingMenu.entries(for:state,exports:exports).first(where:{$0.title.hasPrefix("Exports")})!.submenu
   precondition(menu.first?.title == "Audio — "+leaf+" — failed")
   precondition(menu.first?.submenu.contains(where:{$0.action?.id == "export.retry.audio-"+leaf && $0.enabled}) == true)
  }
  if CommandLine.arguments.count > 1 {
   let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
   let records=try JSONDecoder().decode([ExportsState.Record].self,from:data)
   precondition(!records.isEmpty && records.allSatisfy{$0.kind == .audio})
   for record in records {
    var exports=ExportsState();exports.admit(record)
    var state=ControlsState();state.service = .ready
    let rows=RecordingMenu.entries(for:state,exports:exports).first(where:{$0.title.hasPrefix("Exports")})!.submenu
    precondition(rows.first?.title.hasPrefix("Audio — "+record.leaf) == true)
   }
  }
  print("audio destinations and status controls passed")
 }
}`,
    );
    const args = [];
    if (process.env.SCREENREC_AUDIO_EXPORT_REPORT) {
      const report = JSON.parse(readFileSync(process.env.SCREENREC_AUDIO_EXPORT_REPORT, "utf8"));
      const records = report.exchanges
        .map(({ response }) => (response.structuredContent ?? response).data)
        .filter((v) => v?.kind === "audio" && v.snapshot && v.destination);
      assert.ok(records.length > 0);
      const file = join(scratch, "actual-audio-receipts.json");
      writeFileSync(file, JSON.stringify(records));
      args.push(file);
    }
    assert.match(execFileSync(executable, args, { encoding: "utf8" }), /passed/);
    if (process.env.SCREENREC_AUDIO_EXPORT_CONTROL_EVIDENCE) {
      mkdirSync(process.env.SCREENREC_AUDIO_EXPORT_CONTROL_EVIDENCE, { recursive: true });
      for (const name of readdirSync(scratch))
        copyFileSync(
          join(scratch, name),
          join(process.env.SCREENREC_AUDIO_EXPORT_CONTROL_EVIDENCE, name),
        );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
