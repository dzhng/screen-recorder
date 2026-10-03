"""Plot retained evidence only; run with cached numpy/matplotlib, without DSP."""
import gzip
import hashlib
import json
from pathlib import Path
import tarfile
import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

here = Path(__file__).resolve().parent
prior = here.parent / '13a-endpoint-verification'
evidence = json.loads((prior / 'evidence.json').read_text())
joins = json.loads((prior / 'joins.json').read_text())
receipts = []
plots = []

def checked(data, expected, provenance):
    digest = hashlib.sha256(data).hexdigest()
    assert digest == expected, provenance
    samples = np.frombuffer(data, dtype='<f4')
    assert np.isfinite(samples).all(), provenance
    receipts.append({'source': provenance, 'pcmSha256': digest, 'frames': len(samples)})
    return samples

def save(fig, name):
    path = here / name
    fig.savefig(path, dpi=150)
    plt.close(fig)
    plots.append({'path': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

trusted = {r['path']: r['sha256'] for r in evidence['loaded']}
# Repeated paths must not silently overwrite a conflicting earlier digest.
assert all(trusted[r['path']] == r['sha256'] for r in evidence['loaded'])
# Support extents are consumed from the established measurement report.
for phase in sorted({r['phase'] for r in evidence['endpoints']}):
    fig, axes = plt.subplots(4, 4, figsize=(18, 12), constrained_layout=True)
    for i, speed in enumerate([.8, .9, 1, 1.25]):
        for j, side in enumerate(['leading', 'trailing']):
            row = next(r for r in evidence['endpoints'] if r['phase'] == phase and r['speed'] == speed and r['side'] == side)
            origin = 0 if side == 'leading' else row['wanted']
            support_edges = [row[mode+'Support'][edge] for mode in ['exact', 'tail']
                             for edge in ['firstAboveThreshold', 'lastAboveThreshold']]
            support_edges = [v for v in support_edges if v is not None]
            left = min([0] + [(v-origin)/48 for v in support_edges]) - 10
            right = max([0] + [(v-origin)/48 for v in support_edges]) + 10
            for k, mode in enumerate(['exact', 'tail']):
                ax = axes[i, j*2+k]
                path = here/'pcm'/(Path(row[mode]).name+'.gz')
                samples = checked(gzip.decompress(path.read_bytes()), trusted[row[mode]], str(path.relative_to(here)))
                support = row[mode+'Support']
                start = support['scannedRange']['startFrame']
                x = (np.arange(len(samples)) + start - origin) / 48
                keep = (x >= left) & (x <= right)
                x, y = x[keep], np.abs(samples[keep])
                # Peak bins preserve isolated impulses; no measurement is inferred here.
                if len(x) > 1800:
                    bins = np.array_split(np.arange(len(x)), 1800)
                    x = np.array([x[b[len(b)//2]] for b in bins])
                    y = np.array([y[b].max() for b in bins])
                ax.plot(x, np.maximum(y, 1e-9), linewidth=.8, color='#2154ad' if mode == 'exact' else '#bb651a')
                ax.axhline(1e-7, color='gray', linestyle=':', linewidth=.8)
                ax.axvline(0, color='black', linewidth=.7, linestyle=':')
                file_start, file_end = (start-origin)/48, (start+len(samples)-origin)/48
                if file_start > left: ax.axvspan(left, min(file_start, right), color='#ddd', alpha=.6)
                if file_end < right: ax.axvspan(max(file_end, left), right, color='#ddd', alpha=.6)
                ax.set_yscale('log')
                ax.set(xlim=(left, right), ylim=(1e-9, 2), xlabel='ms relative to output boundary', ylabel='absolute peak envelope')
                ax.set_title(f"{speed}× {side} / {mode} series\n>1e−7 extent: [{support['firstAboveThreshold']}, {support['lastAboveThreshold']}] frames", fontsize=9)
                ax.tick_params(labelsize=8)
    fig.suptitle(f'Isolated impulses, source phase {phase} frames — separated series, shared paired axes\n'
                 'Window includes both reported >1e−7 extents. Gray = outside file; floor = 1e−9; dotted horizontal = 1e−7.\n'
                 'Tail is a separate diagnostic recipe shifted by 2880 frames; it does not prove missing exact-series content.', fontsize=12)
    save(fig, f'endpoint-phase-{phase}.png')

archive = here.parent / '13b-native-stretch-parity/evidence.tar.gz'
with tarfile.open(archive) as tar:
    tone_rows = [('Source', checked(tar.extractfile('frozen/tone-1-exact.f32').read(),
                 trusted[evidence['tones'][0]['input']], str(archive.relative_to(here.parent)) + ':frozen/tone-1-exact.f32'))]
    for row in evidence['tones']:
        member = f"frozen/tone-{row['speed']}-exact.f32"
        tone_rows.append((f"Exact {row['speed']}×", checked(tar.extractfile(member).read(),
                         trusted[row['exact']], str(archive.relative_to(here.parent)) + ':' + member)))
limit = max(float(np.max(np.abs(samples))) for _, samples in tone_rows) * 1.08
fig, axes = plt.subplots(5, 2, figsize=(12, 13), constrained_layout=True)
for (label, samples), pair in zip(tone_rows, axes):
    for side, ax in zip(['leading', 'trailing'], pair):
        boundary = 0 if side == 'leading' else len(samples)
        indices = np.arange(0, 960) if side == 'leading' else np.arange(len(samples)-960, len(samples))
        ax.plot((indices-boundary)/48, samples[indices], linewidth=.8)
        ax.axvline(0, color='black', linestyle=':', linewidth=.8)
        ax.set(xlim=(-1, 20) if side == 'leading' else (-20, 1), ylim=(-limit, limit),
               title=f'{label} / {side}', xlabel='ms relative to file boundary', ylabel='signed amplitude')
        ax.grid(alpha=.18)
fig.suptitle('440 Hz retained tone — first / last 20 ms, every sample\nShared amplitude scale; blank outside the file is unavailable data, not silence.', fontsize=13)
save(fig, 'tone-endpoints.png')

# Decode only the unchanged source; rendered speech is never regenerated here.
source_row = next(r for r in joins['sources'] if r['id'] == 'narration')
source_path = here.parents[3]/source_row['path']
assert hashlib.sha256(source_path.read_bytes()).hexdigest() == source_row['sha256']
source_pcm = checked(subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source_path), '-map', '0:a:0',
                     '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'],
                     check=True, timeout=60, capture_output=True).stdout,
                     source_row['pcmSha256'], source_row['path'])
guarded = [r for r in joins['selections'] if 'markedFileUs' in r]
for page, subset in enumerate([guarded[:4], guarded[4:]], 1):
    fig, axes = plt.subplots(len(subset), 2, figsize=(12, 3*len(subset)), constrained_layout=True)
    for selection, pair in zip(subset, axes):
        limit = max(float(np.abs(source_pcm[b-4800:b+4801]).max()) for b in selection['frames'])*1.08
        for side_index, (boundary, ax) in enumerate(zip(selection['frames'], pair)):
            indices = np.arange(boundary-4800, boundary+4801)
            delta = (selection['markedFileUs'][side_index]*.048-boundary)/48
            ax.plot((indices-boundary)/48, source_pcm[indices], linewidth=.6)
            ax.axvspan(min(0,delta), max(0,delta), color='#edb94f', alpha=.25)
            ax.axvline(delta, color='#916200', linestyle='--', linewidth=1.2)
            ax.axvline(0, color='black', linestyle=':', linewidth=1)
            ax.set(xlim=(-100,100), ylim=(-limit,limit), xlabel='ms relative to source selection boundary',
                   ylabel='signed amplitude', title=selection['id'] + (' / leading' if side_index == 0 else ' / trailing'))
            ax.grid(alpha=.18)
    fig.suptitle('Authored source guards — all seven phrase selections, page ' + str(page) + '/2\n'
                 'Black dotted = selection edge; gold dashed = manual mark; shaded = 25 ms source guard.\n'
                 'Manual marks have ±25 ms uncertainty. No output word positions or complete word-span labels.', fontsize=12)
    save(fig, f'source-guards-{page}.png')

for selection in joins['selections']:
    reference_path = prior / 'auditions' / (selection['id'] + '-reference.wav')
    if not reference_path.exists():
        continue
    rows = []
    for speed in [1, .8, 1.25]:
        row = next(r for r in joins['results'] if r['id'] == selection['id'] and r['speed'] == speed)
        path = reference_path if speed == 1 else prior / 'auditions' / Path(row['file']).name
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == row['wavSha256'], path
        assert data[:4] == b'RIFF' and data[36:40] == b'data'
        samples = checked(data[44:], row['contextSha256'], str(path.relative_to(here.parent)))
        rows.append(('Reference (identity)' if speed == 1 else f'Exact {speed}×', samples, row['joins']))
    limit = max(float(np.abs(samples[max(0,b-4800):min(len(samples),b+4801)]).max())
                for _, samples, boundaries in rows for b in boundaries) * 1.08
    fig, axes = plt.subplots(3, 2, figsize=(12, 9), constrained_layout=True)
    for row_index, ((label, samples, boundaries), pair) in enumerate(zip(rows, axes)):
        for side_index, (boundary, ax) in enumerate(zip(boundaries, pair)):
            indices = np.arange(max(0, boundary-4800), min(len(samples), boundary+4801))
            ax.plot((indices-boundary)/48, samples[indices], linewidth=.6)
            ax.axvline(0, color='black', linestyle=':', linewidth=1, label='Selected-range boundary')
            if row_index == 0 and 'markedFileUs' in selection:
                # These are authored SOURCE coordinates, never inferred output word positions.
                mark = selection['markedFileUs'][side_index] * .048
                delta = (mark - selection['frames'][side_index]) / 48
                ax.axvspan(min(0, delta), max(0, delta), color='#edb94f', alpha=.25, label='Source guard')
                ax.axvline(delta, color='#916200', linestyle='--', linewidth=1.2, label='Manual phrase mark')
            side = 'leading' if side_index == 0 else 'trailing'
            ax.set(xlim=(-100, 100), ylim=(-limit, limit), title=f'{label} / {side}',
                   xlabel='ms relative to selected-range boundary', ylabel='signed amplitude')
            ax.grid(alpha=.18)
    caption = ('Reference only: gold shade = source guard; gold dashed = manual mark; black dotted = selection edge.\n'
               'Marks ±25 ms uncertain; no output guard/word positions or complete word-span labels.'
               if 'markedFileUs' in selection else
               'Whole-file control: no guards or external neighbors. Blank outside file is unavailable data.')
    fig.suptitle(selection['id'] + ' — retained reference / slowed / sped joins\n' + caption, fontsize=12)
    save(fig, selection['id'] + '-guards.png')

manifest = {'scope': 'Qualitative separated endpoint support windows, retained tone endpoints and representative speech guards; frozen reconstruction hash-verified.',
            'evidenceSha256': hashlib.sha256((prior/'evidence.json').read_bytes()).hexdigest(),
            'joinsSha256': hashlib.sha256((prior/'joins.json').read_bytes()).hexdigest(),
            'plotterSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'matplotlib': matplotlib.__version__, 'numpy': np.__version__, 'verifiedPCM': receipts, 'plots': plots}
(here/'plots.json').write_text(json.dumps(manifest, indent=2)+'\n')
