import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const nativeHelper = fileURLToPath(
  new URL("../../packages/test-harness/editing/runtime-native.py", import.meta.url),
);
test("native command timeout retains partial diagnostics and both operands", () => {
  const code = `import runpy,struct,tempfile,json,shutil,hashlib,subprocess
from pathlib import Path
module=runpy.run_path(${JSON.stringify(nativeHelper)});relocate=module['relocate']
with tempfile.TemporaryDirectory() as folder:
    root=Path(folder);bundle=root/'bundle';bundle.mkdir();target=bundle/'native';name=b'/foreign/build\\0';size=(12+len(name)+7)//8*8
    command=struct.pack('<III',0x8000001c,size,12)+name;command+=bytes(size-len(command));target.write_bytes(struct.pack('<8I',0xfeedfacf,0x100000c,0,6,1,size,0,0)+command)
    source=root/'source';shutil.copyfile(target,source);sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    policy=root/'policy.json';policy.write_text(json.dumps({'files':[{'path':'native','sourceSha256':sha(source),'removeRpaths':['/foreign/build']}]}))
    def timeout(command,**kwargs):raise subprocess.TimeoutExpired(command,10,output=b'partial output',stderr=b'partial stderr')
    original=subprocess.run;subprocess.run=timeout
    try:
        try:relocate(policy,bundle,{'native':str(source)},root,shutil.copyfile,sha)
        except subprocess.TimeoutExpired:pass
        else:raise AssertionError('timeout accepted')
    finally:subprocess.run=original
    row=json.loads((root/'native-relocation.json').read_text())['files'][0]
    assert row['commands'][0]['stderr']=='partial stderr' and row['commands'][0]['stdout']=='partial output' and row['commands'][0]['timedOut']
    assert (root/row['beforeFile']).read_bytes()==source.read_bytes() and (root/row['afterFile']).read_bytes()==target.read_bytes()
print('retained')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "retained");
});
test("invalid final native bytes retain their hash and original command failure", () => {
  const code = `import runpy,struct,tempfile,json,shutil,hashlib,subprocess,sys
from pathlib import Path
relocate=runpy.run_path(${JSON.stringify(nativeHelper)})['relocate']
folder=tempfile.mkdtemp(prefix='runtime-native-invalid-')
print('Unverified native control operands:',folder,file=sys.stderr)
root=Path(folder);bundle=root/'bundle';bundle.mkdir();target=bundle/'native';name=b'/foreign/build\\0';size=(12+len(name)+7)//8*8
command=struct.pack('<III',0x8000001c,size,12)+name;command+=bytes(size-len(command));target.write_bytes(struct.pack('<8I',0xfeedfacf,0x100000c,0,6,1,size,0,0)+command)
source=root/'source';shutil.copyfile(target,source);sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
policy=root/'policy.json';policy.write_text(json.dumps({'files':[{'path':'native','sourceSha256':sha(source),'removeRpaths':['/foreign/build']}]}))
def fail(command,**kwargs):
    target.write_bytes(b'invalid complete final operand')
    return subprocess.CompletedProcess(command,1,'partial stdout','packaging failed')
original=subprocess.run;subprocess.run=fail
try:
    try:relocate(policy,bundle,{'native':str(source)},root,shutil.copyfile,sha)
    except AssertionError as error:
        assert str(error)=='Native packaging command failed','inspection masked original command failure'
    else:raise AssertionError('failed command accepted')
finally:subprocess.run=original
row=json.loads((root/'native-relocation.json').read_text())['files'][0]
final=root/row['afterFile']
assert final.read_bytes()==b'invalid complete final operand'
assert row['finalSha256']==sha(final),'receipt describes earlier bytes'
assert row['after'] is None and row['afterInspectionError']=='Expected thin arm64 Mach-O'
assert not row['verified'] and row['commands'][0]['stderr']=='packaging failed'
shutil.rmtree(folder)
print('retained')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "retained");
});
test("failed final capture retains the earlier snapshot and original command failure", () => {
  const code = `import runpy,struct,tempfile,json,shutil,hashlib,subprocess,sys
from pathlib import Path
relocate=runpy.run_path(${JSON.stringify(nativeHelper)})['relocate']
folder=tempfile.mkdtemp(prefix='runtime-native-invalid-')
print('Unverified native control operands:',folder,file=sys.stderr)
root=Path(folder);bundle=root/'bundle';bundle.mkdir();target=bundle/'native';name=b'/foreign/build\\0';size=(12+len(name)+7)//8*8
command=struct.pack('<III',0x8000001c,size,12)+name;command+=bytes(size-len(command));target.write_bytes(struct.pack('<8I',0xfeedfacf,0x100000c,0,6,1,size,0,0)+command)
source=root/'source';shutil.copyfile(target,source);sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
policy=root/'policy.json';policy.write_text(json.dumps({'files':[{'path':'native','sourceSha256':sha(source),'removeRpaths':['/foreign/build']}]}))
def fail(command,**kwargs):
    target.write_bytes(b'invalid complete final operand')
    return subprocess.CompletedProcess(command,1,'partial stdout','packaging failed')
def capture(source,destination):
    if source.read_bytes()==b'invalid complete final operand':raise OSError('fixture capture refused')
    shutil.copyfile(source,destination)
original=subprocess.run;subprocess.run=fail
try:
    try:relocate(policy,bundle,{'native':str(source)},root,capture,sha)
    except AssertionError as error:
        assert str(error)=='Native packaging command failed','inspection masked original command failure'
    else:raise AssertionError('failed command accepted')
finally:subprocess.run=original
row=json.loads((root/'native-relocation.json').read_text())['files'][0]
final=root/row['afterFile']
assert final.read_bytes()==source.read_bytes(),'earlier snapshot lost'
assert row['finalSha256']==sha(final),'receipt describes earlier bytes'
assert not row['finalCaptureComplete'] and row['finalCaptureError']=='fixture capture refused'
assert not row['verified'] and row['commands'][0]['stderr']=='packaging failed'
shutil.rmtree(folder)
print('retained')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "retained");
});
test("stale native source policy retains both complete operands before refusing", () => {
  const code = `import runpy,struct,tempfile,json,shutil,hashlib
from pathlib import Path
relocate=runpy.run_path(${JSON.stringify(nativeHelper)})['relocate']
with tempfile.TemporaryDirectory() as folder:
    root=Path(folder);bundle=root/'bundle';bundle.mkdir();target=bundle/'native'
    target.write_bytes(struct.pack('<8I',0xfeedfacf,0x100000c,0,6,0,0,0,0));source=root/'source';shutil.copyfile(target,source)
    policy=root/'policy.json';policy.write_text(json.dumps({'files':[{'path':'native','sourceSha256':'0'*64,'removeRpaths':['/foreign/build']}]}))
    sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    try:relocate(policy,bundle,{'native':str(source)},root,shutil.copyfile,sha)
    except AssertionError:pass
    else:raise AssertionError('stale policy accepted')
    report=json.loads((root/'native-relocation.json').read_text());row=report['files'][0]
    assert (root/row['beforeFile']).read_bytes()==source.read_bytes()
    assert (root/row['afterFile']).read_bytes()==target.read_bytes(),'final preflight operand lost'
print('retained')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "retained");
});
test("native observer distinguishes required loads and both dependency versions", () => {
  const code = `import runpy,struct,tempfile
from pathlib import Path
inspect=runpy.run_path(${JSON.stringify(nativeHelper)})['inspect']
def observe(kind,current,compatibility):
    name=b'/usr/lib/libSystem.B.dylib\\0';size=(24+len(name)+7)//8*8
    command=struct.pack('<IIIIII',kind,size,24,0,current,compatibility)+name
    command+=bytes(size-len(command))
    header=struct.pack('<8I',0xfeedfacf,0x100000c,0,6,1,size,0,0)
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder)/'native';path.write_bytes(header+command)
        return inspect(path)['loads']
assert observe(0xc,0x10000,0x10000)!=observe(0x80000018,0x10000,0x10000),'mandatory/weak load collapsed'
assert observe(0xc,0x10000,0x10000)!=observe(0xc,0x20000,0x10000),'current version collapsed'
assert observe(0xc,0x10000,0x10000)!=observe(0xc,0x10000,0x20000),'compatibility version collapsed'
print('distinct')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "distinct");
});

const assemble = fileURLToPath(
  new URL("../../packages/test-harness/editing/optional-runtime-assemble.py", import.meta.url),
);
const launcher = fileURLToPath(new URL("./launch.py", import.meta.url));
test("explicit native relocation removes a foreign search path while retaining sections, signatures and complete operands", () => {
  const scratch = mkdtempSync(join(tmpdir(), "runtime-native-"));
  try {
    const source = join(scratch, "sources"),
      base = join(source, "base"),
      primary = join(source, "primary");
    mkdirSync(join(base, "bin"), { recursive: true });
    mkdirSync(join(base, "lib/python3.12/site-packages"), { recursive: true });
    mkdirSync(primary);
    writeFileSync(join(base, "bin/python3.12"), "pinned test interpreter");
    const c = join(source, "sample.c"),
      library = join(primary, "sample.dylib");
    writeFileSync(c, "const int marker=17; int answer(void){return marker+25;}\n");
    const compiled = spawnSync(
      "/usr/bin/clang",
      [
        "-arch",
        "arm64",
        "-dynamiclib",
        c,
        "-Wl,-rpath,/outside/original-wheel-build",
        "-o",
        library,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(compiled.status, 0, compiled.stderr);
    const original = readFileSync(library),
      sha256 = createHash("sha256").update(original).digest("hex");
    const policy = join(source, "native-policy.json");
    writeFileSync(
      policy,
      JSON.stringify({
        files: [
          {
            path: "python/lib/python3.12/site-packages/sample.dylib",
            sourceSha256: sha256,
            removeRpaths: ["/outside/original-wheel-build"],
          },
        ],
      }),
    );
    const worker = join(source, "worker.py");
    writeFileSync(worker, 'print("unused")\n');
    const out = join(scratch, "assembled");
    const built = spawnSync(
      "/usr/bin/python3",
      [
        "-I",
        "-B",
        assemble,
        "--base",
        base,
        "--primary",
        primary,
        "--worker",
        worker,
        "--launcher",
        launcher,
        "--native-policy",
        policy,
        "--out",
        out,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(built.status, 0, built.stderr);
    const report = JSON.parse(readFileSync(join(out, "assembly.json"))),
      patch = report.nativeRelocation.files[0];
    assert.deepEqual(patch.before.sections, patch.after.sections);
    assert.deepEqual(patch.before.loads, patch.after.loads);
    assert.deepEqual(patch.before.rpaths, ["/outside/original-wheel-build"]);
    assert.deepEqual(patch.after.rpaths, []);
    assert.equal(patch.sourceSha256, sha256);
    assert.notEqual(patch.finalSha256, sha256);
    assert.deepEqual(readFileSync(library), original, "donor unchanged");
    assert.deepEqual(
      readFileSync(join(out, patch.beforeFile)),
      original,
      "complete original retained",
    );
    assert.deepEqual(
      readFileSync(join(out, patch.afterFile)),
      readFileSync(join(out, "bundle", patch.path)),
      "complete final retained",
    );
    const verified = spawnSync(
      "/usr/bin/codesign",
      ["--verify", "--strict", join(out, "bundle", patch.path)],
      { encoding: "utf8" },
    );
    assert.equal(verified.status, 0, verified.stderr);
  } catch (error) {
    const diagnostic = mkdtempSync(join(tmpdir(), "runtime-native-failure-"));
    const saved = spawnSync("/bin/cp", ["-cR", scratch, join(diagnostic, "operands")], {
      encoding: "utf8",
      timeout: 5000,
    });
    console.error("Unverified native test operands retained at", diagnostic);
    if (saved.status !== 0) console.error(saved.stderr);
    throw error;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
