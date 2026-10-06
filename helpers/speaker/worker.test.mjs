import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const entry = fileURLToPath(new URL("./worker.py", import.meta.url));
test("transposed native axes refuse before a reshape can mix time and speaker slots", () => {
  const script = `import runpy
worker=runpy.run_path(${JSON.stringify(entry)})
class DType:str='<f4'
class Array:
    dtype=DType()
    shape=(4,375)
    def reshape(self,*args):
        self.shape=(375,4)
        return self
    def tolist(self):return [[.125,.25,.5,.875] for _ in range(375)]
try:worker['decode_native']([[]],[Array()],'native-unverified.json',480000)
except worker['Refusal'] as error:
    assert error.code=='MODEL_CONTRACT_CHANGED' and error.details=={'rawFile':'native-unverified.json','verified':False}
else:raise AssertionError('Transposed native axes were accepted')
print('refused')
`;
  const child = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", script], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "refused");
});
test("retryable preparation failure releases only its empty output reservations", () => {
  const scratch = mkdtempSync(join(tmpdir(), "speaker-prepare-"));
  try {
    const pcm = Buffer.alloc(480000 * 4),
      path = join(scratch, "source.f32"),
      output = join(scratch, "raw.json");
    writeFileSync(path, pcm);
    const request = {
      id: "source-window",
      operation: "speaker.observe",
      params: {
        model: join(scratch, "missing.nemo"),
        pcm: path,
        pcmSha256: createHash("sha256").update(pcm).digest("hex"),
        frames: 480000,
        sampleRate: 16000,
        output,
      },
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const child = spawnSync("/usr/bin/python3", ["-I", "-B", entry], {
        input: JSON.stringify(request) + "\n",
        encoding: "utf8",
        timeout: 3000,
      });
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(child.stdout);
      assert.equal(result.error.code, "MODEL_NOT_PREPARED");
      assert.equal(result.error.retryable, true);
      assert.equal(existsSync(output), false);
      assert.equal(existsSync(output + ".native-unverified.json"), false);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("original speaker input refuses an unsupported physical extent before loading any model", () => {
  const scratch = mkdtempSync(join(tmpdir(), "speaker-input-"));
  try {
    const pcm = Buffer.alloc(479999 * 4);
    const path = join(scratch, "source.f32");
    writeFileSync(path, pcm);
    const request = {
      id: "source-window",
      operation: "speaker.observe",
      params: {
        model: join(scratch, "missing.nemo"),
        pcm: path,
        pcmSha256: createHash("sha256").update(pcm).digest("hex"),
        frames: 479999,
        sampleRate: 16000,
        output: join(scratch, "raw.json"),
      },
    };
    const child = spawnSync("/usr/bin/python3", ["-I", "-B", entry], {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "UNSUPPORTED_SPEAKER_WINDOW");
    assert.equal(result.error.retryable, false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("native decoding preserves simultaneous slots, source endpoints and every probability row", () => {
  const script = `import runpy,json,struct
worker=runpy.run_path(${JSON.stringify(entry)})
class DType:
    str='<f4'
class Array:
    dtype=DType()
    shape=(1,375,4)
    def reshape(self,*args):
        assert args==(-1,4)
        self.shape=(375,4)
        return self
    def tolist(self):return [[.125,.25,.5,.875] for _ in range(375)]
lines=['0.0 30.0 speaker_0','1.2 4.56 speaker_3','2.4 7.2 speaker_1']
result=worker['decode_native']([lines],[Array()],'unverified.json',480000)
assert result=={'segments':[{'speaker':'speaker_0','start':0.0,'end':30.0},{'speaker':'speaker_3','start':1.2,'end':4.56},{'speaker':'speaker_1','start':2.4,'end':7.2}], 'nativeSegmentLines':lines, 'nativeProbabilities':[[.125,.25,.5,.875] for _ in range(375)], 'probabilityShape':[375,4]}
print('preserved')
`;
  const child = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", script], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "preserved");
});
test("native decoding accepts a bounded selected window with matching score cells", () => {
  const script = `import runpy
worker=runpy.run_path(${JSON.stringify(entry)})
class DType:
    str='<f4'
class Array:
    dtype=DType()
    shape=(1,125,4)
    def reshape(self,*args):
        assert args==(-1,4)
        self.shape=(125,4)
        return self
    def tolist(self):return [[.125,.25,.375,.5] for _ in range(125)]
lines=['0.0 10.0 speaker_0']
result=worker['decode_native']([lines],[Array()],'unverified.json',160000)
assert len(result['nativeProbabilities'])==125 and result['probabilityShape']==[125,4]
assert result['segments']==[{'speaker':'speaker_0','start':0.0,'end':10.0}]
print('bounded')
`;
  const child = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", script], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "bounded");
});
test("missing source bytes are an invalid input rather than a request to prepare a model", () => {
  const scratch = mkdtempSync(join(tmpdir(), "speaker-input-"));
  try {
    const request = {
      id: "source-window",
      operation: "speaker.observe",
      params: {
        model: join(scratch, "missing.nemo"),
        pcm: join(scratch, "missing.f32"),
        pcmSha256: "a".repeat(64),
        frames: 480000,
        sampleRate: 16000,
        output: join(scratch, "raw.json"),
      },
    };
    const child = spawnSync("/usr/bin/python3", ["-I", "-B", entry], {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_SPEAKER_INPUT");
    assert.equal(result.error.retryable, false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("malformed request JSON is a caller refusal", () => {
  const child = spawnSync("/usr/bin/python3", ["-I", "-B", entry], {
    input: "{\n",
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.error.code, "INVALID_REQUEST");
  assert.equal(result.error.retryable, false);
});
test("unavailable output destination refuses before checkpoint access", () => {
  const scratch = mkdtempSync(join(tmpdir(), "speaker-output-"));
  try {
    const pcm = Buffer.alloc(480000 * 4);
    const path = join(scratch, "source.f32");
    writeFileSync(path, pcm);
    const request = {
      id: "source-window",
      operation: "speaker.observe",
      params: {
        model: join(scratch, "missing.nemo"),
        pcm: path,
        pcmSha256: createHash("sha256").update(pcm).digest("hex"),
        frames: 480000,
        sampleRate: 16000,
        output: join(scratch, "missing-parent/raw.json"),
      },
    };
    const child = spawnSync("/usr/bin/python3", ["-I", "-B", entry], {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.error.code, "INVALID_SPEAKER_OUTPUT");
    assert.equal(result.error.retryable, false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("invalid native scores and malformed lines remain lossless unverified operands", () => {
  const scratch = mkdtempSync(join(tmpdir(), "speaker-native-"));
  try {
    const script = `import runpy,struct,json,base64
from pathlib import Path
worker=runpy.run_path(${JSON.stringify(entry)})
class DType:
    str='<f4'
class Array:
    dtype=DType()
    shape=(1,375,4)
    def tobytes(self):return struct.pack('<ff',float('nan'),float('inf'))+bytes(1498*4)
    def reshape(self,*args):
        self.shape=(375,4)
        return self
    def tolist(self):return [[float('nan'),float('inf'),0.,0.]]+[[0.,0.,0.,0.] for _ in range(374)]
path=Path(${JSON.stringify(join(scratch, "raw.native-unverified.json"))})
with path.open('x') as file:worker['capture_native']([['malformed line']],[Array()],file)
try:worker['decode_native']([['malformed line']],[Array()],str(path),480000)
except worker['Refusal'] as error:
    assert error.code=='MODEL_CONTRACT_CHANGED' and error.details['rawFile']==str(path)
else:raise AssertionError('Expected refusal')
raw=json.loads(path.read_text());assert raw['verified'] is False and raw['nativeSegmentLines']==[['malformed line']]
assert raw['nativeTensors'][0]['shape']==[1,375,4] and raw['nativeTensors'][0]['dtype']=='<f4'
values=struct.unpack('<ff',base64.b64decode(raw['nativeTensors'][0]['bytesBase64'])[:8]);assert values[0]!=values[0] and values[1]==float('inf')
print('retained')
`;
    const child = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", script], {
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), "retained");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
