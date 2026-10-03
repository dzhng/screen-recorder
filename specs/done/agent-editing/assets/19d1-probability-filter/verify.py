"""Bounded numeric experiment; never loads a model or modifies the installed backend."""
import argparse, hashlib, inspect, json, math, runpy, sys, time
from pathlib import Path
import mlx.core as mx
import numpy as np
from mlx_audio.tts.models.qwen3_tts import qwen3_tts as backend
from mlx_audio.lm import sample_utils
original = backend._apply_probability_filters
parser = argparse.ArgumentParser()
parser.add_argument('--model-config', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
here = Path(__file__).resolve().parent
repaired = runpy.run_path(str(here / 'candidate.py'))['probability_filters']
out = args.out
out.mkdir()
model_config = args.model_config
eos = json.loads(model_config.read_text())['talker_config']['codec_eos_token_id']
source = Path(inspect.getfile(backend))
assert hashlib.sha256(source.read_bytes()).hexdigest() == '0d9437e4f08680d7bf8cb7bf3b44c8e3de37ad9edf025f50dba37dface2e6902'

assert hashlib.sha256(Path(inspect.getfile(sample_utils)).read_bytes()).hexdigest() == '9a6a7279c7aff850cdf80dd7f77ece1c31c3441ddacee595fbf83d013f60cc41'

def capture(row, helper):
    size = row['vocabulary']
    if 'active' in row:
        logits = mx.concatenate([mx.zeros(row['active']), mx.full((size - row['active'],), -100)]).astype(mx.bfloat16)[None, None, :]
    else:
        logits = mx.linspace(-20, 20, size).astype(mx.bfloat16)[None, None, :]
    history = list(range(64)) if row['history'] == 'low64' else list(range(1984, 2048)) if row['history'] == 'high64' else None
    found = {}

    def trace(frame, event, arg):
        if frame.f_code is not backend.Model._sample_token.__code__:
            return None
        if event == 'return':
            found['logits'] = frame.f_locals['logits']
        return trace
    backend._apply_probability_filters = helper
    mx.random.seed(18)
    sys.settrace(trace)
    try:
        token = backend.Model._sample_token(None, logits, temperature=row['temperature'], top_k=row['top_k'], top_p=row['top_p'], repetition_penalty=row['repetition_penalty'], generated_tokens=history, suppress_tokens=[i for i in range(size - 1024, size) if i != eos] if history else None)
        mx.eval(token)
    finally:
        sys.settrace(None)
        backend._apply_probability_filters = original
    values = found['logits']
    p = mx.softmax(values.astype(mx.float32), axis=-1)
    mx.eval(values, p)
    metrics = {'nan': bool(mx.any(mx.isnan(values)).item()), 'positiveInfinity': bool(mx.any(values == mx.inf).item()), 'finiteCandidates': int(mx.sum(mx.isfinite(values)).item()), 'probabilitiesFinite': bool(mx.all(mx.isfinite(p)).item()), 'probabilitySum': float(mx.sum(p).item()), 'positiveProbabilities': int(mx.sum(p > 0).item()), 'token': token.tolist(), 'dtype': str(values.dtype), 'shape': values.shape}
    metrics['valid'] = not metrics['nan'] and (not metrics['positiveInfinity']) and (metrics['finiteCandidates'] > 0) and metrics['probabilitiesFinite'] and (metrics['positiveProbabilities'] > 0) and (abs(metrics['probabilitySum'] - 1) < 1e-05)
    metrics['logitsFloat32Sha256'] = hashlib.sha256(np.asarray(values.astype(mx.float32)).tobytes()).hexdigest()
    metrics['rngState'] = np.asarray(mx.random.state[0]).tolist()
    return metrics
report = {'scope': 'Tiny sampler-only candidate; no runtime integration, model load, audio synthesis, or quality claim', 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'rows': [], 'invalid': []}
for kind, path in [('extremes', here / 'inherited-extremes.json'), ('uniform', here / 'inherited-uniform.json')]:
    prior = json.loads(path.read_text())
    for index, row in enumerate(prior['rows']):
        old = capture(row, original)
        new = capture(row, repaired)
        assert old['valid'] == row['valid'], (kind, index, 'inherited status drift', old, row)
        assert old['token'] == row['token'], (kind, index, 'inherited token drift')
        assert new['valid'], (kind, index, new)
        assert old['dtype'] == new['dtype'] and old['shape'] == new['shape']
        if old['valid']:
            assert new['logitsFloat32Sha256'] == old['logitsFloat32Sha256'], (kind, index, 'valid logits changed')
            assert new['token'] == old['token'] and new['rngState'] == old['rngState'], (kind, index, 'valid RNG changed')
        report['rows'].append({'cohort': kind, 'index': index, 'request': row, 'original': old, 'candidate': new})
for name, values in [('nan', [0, float('nan'), -float('inf')]), ('positive-inf', [0, float('inf'), -float('inf')]), ('all-masked', [-float('inf')] * 3)]:
    for top_p in [5e-324, 0.01, 1]:
        logits = mx.array([values], dtype=mx.bfloat16)
        value = repaired(logits, top_p, 0)
        baseline = original(logits, top_p, 0)
        mx.eval(value, baseline)
        assert np.asarray(value.astype(mx.float32)).tobytes() == np.asarray(baseline.astype(mx.float32)).tobytes()
        assert not bool(mx.all(mx.isfinite(value) | (value == -mx.inf)).item()) or not bool(mx.any(mx.isfinite(value)).item())
        report['invalid'].append({'name': name, 'top_p': top_p, 'classification': 'invalid; unchanged from backend, not runtime-refused or rescued'})
report['direct'] = []
for dtype in [mx.bfloat16, mx.float16, mx.float32]:
    maximum = 3.3895313892515355e+38 if dtype == mx.bfloat16 else 65504 if dtype == mx.float16 else 3.4028234663852886e+38
    for shape, rows in [('batch', [[1, -mx.inf, 0], [0, 0, -mx.inf]]), ('extreme', [[maximum, -maximum, -mx.inf], [-maximum, -maximum, -mx.inf]]), ('masked', [[-mx.inf, 0, -mx.inf]])]:
        logits = mx.array(rows, dtype=dtype)
        for top_p in [5e-324, 0.01, 0.8, math.nextafter(1, 0), 1]:
            mx.random.seed(18)
            state = np.asarray(mx.random.state[0]).copy()
            value = repaired(logits, top_p, 0)
            p = mx.softmax(value.astype(mx.float32), axis=-1)
            mx.eval(value, p)
            assert value.dtype == logits.dtype and value.shape == logits.shape
            assert np.array_equal(state, np.asarray(mx.random.state[0]))
            assert bool(mx.all(mx.any(mx.isfinite(value), axis=-1)).item())
            assert bool(mx.all(mx.where(logits == -mx.inf, value == -mx.inf, True)).item())
            assert bool(mx.all(mx.isfinite(p)).item()) and bool(mx.all(mx.sum(p, axis=-1) > 0).item())
            assert bool(mx.all(mx.abs(mx.sum(p, axis=-1) - 1) < 1e-05).item())
            report['direct'].append({'dtype': str(dtype), 'shape': shape, 'top_p': top_p, 'finiteCounts': mx.sum(mx.isfinite(value), axis=-1).tolist(), 'probabilitySums': mx.sum(p, axis=-1).tolist()})
tied = mx.concatenate([mx.zeros(63), mx.full((3072 - 63,), -100)]).astype(mx.bfloat16)[None, :]
assert not bool(mx.any(mx.isfinite(original(tied, 0.01, 0))).item())
fixed = repaired(tied, 0.01, 0)
assert mx.argmax(fixed, axis=-1).item() == 0 and mx.sum(mx.isfinite(fixed)).item() == 1
report['summary'] = {'inheritedCases': len(report['rows']), 'inheritedRed': sum((not r['original']['valid'] for r in report['rows'])), 'previouslyValidExact': sum((r['original']['valid'] for r in report['rows'])), 'invalidUnchanged': len(report['invalid']), 'directCases': len(report['direct']), 'emptyTieFirstMaximum': True}
default_logits = mx.array([[1, 0, -mx.inf]], dtype=mx.bfloat16)
assert repaired(default_logits, 1, 0) is default_logits
assert repaired(default_logits, 0, 0) is default_logits
report['summary']['exactDefaultBypass'] = True
report['candidateSha256'] = hashlib.sha256((here / 'candidate.py').read_bytes()).hexdigest()
report['timing'] = []
logits = mx.linspace(-20, 20, 3072).astype(mx.bfloat16)[None, None, :]
for top_p in [1, 0.8]:
    for repeat in range(3):
        for name, helper in [('original', original), ('candidate', repaired)] if repeat % 2 == 0 else [('candidate', repaired), ('original', original)]:
            backend._apply_probability_filters = helper
            mx.random.seed(18)
            try:
                for _ in range(10):
                    mx.eval(backend.Model._sample_token(None, logits, top_p=top_p))
                start = time.perf_counter()
                for _ in range(100):
                    mx.eval(backend.Model._sample_token(None, logits, top_p=top_p))
                elapsed = time.perf_counter() - start
            finally:
                backend._apply_probability_filters = original
            report['timing'].append({'top_p': top_p, 'repeat': repeat, 'helper': name, 'calls': 100, 'seconds': elapsed})
report['environment'] = {'python': sys.version, 'modelConfigSha256': hashlib.sha256(model_config.read_bytes()).hexdigest(), 'candidateSha256': hashlib.sha256((here / 'candidate.py').read_bytes()).hexdigest(), 'harnessSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report['summary']))
