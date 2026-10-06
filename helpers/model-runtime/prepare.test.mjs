import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const prepare = fileURLToPath(new URL("./prepare.py", import.meta.url));

test("offline preparation child outputs use reproducible modes under a restrictive caller mask", () => {
  const code = `import runpy,tempfile,os,json
from pathlib import Path
prepare=runpy.run_path(${JSON.stringify(prepare)})['prepare']
with tempfile.TemporaryDirectory() as scratch:
    root=Path(scratch);base=root/'base';(base/'bin').mkdir(parents=True)
    python=base/'bin/python3.12'
    python.write_text('#!/usr/bin/python3\\nimport sys\\nfrom pathlib import Path\\nif any(x.endswith("assemble.py") for x in sys.argv):\\n out=Path(sys.argv[sys.argv.index("--out")+1])/"bundle";out.mkdir(parents=True);(out/"worker.py").write_text("retained")\\n')
    python.chmod(0o755);directory=root/'content';directory.mkdir()
    os.umask(0o077)
    assert prepare({'inputs':str(root),'base':str(base),'directory':str(directory),'acquisition':{'recipe':'python-wheels-v1','installs':[],'files':[],'nativePolicy':{'files':[]}}})=={'ready':True}
    assert (directory.stat().st_mode & 0o777)==0o755
    assert ((directory/'worker.py').stat().st_mode & 0o777)==0o644
print('reproducible')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "reproducible");
});

test("offline runtime provenance is identical after preparation in different private paths", () => {
  const code = `import runpy,tempfile,json,csv,hashlib,base64
from pathlib import Path
normalize=runpy.run_path(${JSON.stringify(prepare)})['normalize_installed']
with tempfile.TemporaryDirectory() as scratch:
    snapshots=[]
    pin={'path':'example.whl','url':'https://files.pythonhosted.org/pinned/example.whl','sha256':'a'*64}
    for name in ['first-private-build','another-private-build']:
        primary=Path(scratch)/name;metadata=primary/'example.dist-info';metadata.mkdir(parents=True)
        direct=metadata/'direct_url.json';direct.write_text(json.dumps({'url':'file:///'+name+'/example.whl','archive_info':{'hashes':{'sha256':'a'*64}}}))
        (metadata/'RECORD').write_text('example.dist-info/direct_url.json,old,1\\n../../bin/example,private-'+name+',99\\nexample.py,retained,15\\nexample.dist-info/RECORD,,\\n')
        normalize(primary,[pin])
        value=json.loads(direct.read_text());assert value=={'url':pin['url'],'archive_info':{'hashes':{'sha256':pin['sha256']}}}
        rows=list(csv.reader((metadata/'RECORD').read_text().splitlines()))
        payload=direct.read_bytes();hashed='sha256='+base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip('=')
        assert rows==[['example.dist-info/direct_url.json',hashed,str(len(payload))],['example.py','retained','15'],['example.dist-info/RECORD','','']]
        snapshots.append([direct.read_bytes(),(metadata/'RECORD').read_bytes()])
    assert snapshots[0]==snapshots[1]
print('identical')
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "identical");
});
