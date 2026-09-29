"""Render frozen splice timing evidence; never rewrite audio or infer audibility."""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

out = Path(__file__).resolve().parent
assets = out.parent
paths = [assets/'18-voice/context.wav',
         assets/'18-voice-roomtone/phrase-room-context.wav',
         assets/'18-voice-phrase-lead/phrase-shorter-lead-context.wav']
labels = ['Original recorded context', 'Previous phrase + recorded hum',
          'Current phrase: 120 ms shorter entrance']
loaded = [wavfile.read(p) for p in paths]
assert all(r == 24000 and x.ndim == 1 and x.dtype == np.float32
           and np.isfinite(x).all() for r, x in loaded)
rate = 24000
original, previous, current = [x for _, x in loaded]
lead = json.loads((assets/'18-voice-phrase-lead/report.json').read_text())
room = json.loads((assets/'18-voice-roomtone/report.json').read_text())
phrase = next(c for c in room['cases'] if c['id'] == 'phrase')
first, last = [round((t - 71500000)*rate/1e6)
               for t in phrase['replacedTimelineRangeUs']]
n = phrase['transitionSamples']
insert_frames = round(np.diff(phrase['keptGeneratedSeconds'])[0]*rate)
trim = round(lead['trimmedLeadMs']*rate/1000)
assert first == lead['suffixComparison']['newStartFrame']
assert first + trim == lead['suffixComparison']['previousStartFrame']
assert np.array_equal(current[:first-n], previous[:first-n])
assert np.array_equal(current[first:], previous[first+trim:])
assert len(previous) - len(current) == trim
assert hashlib.sha256(paths[2].read_bytes()).hexdigest() == lead['outputSha256']
# Align each boundary to the start of its transition, not a fitted signal offset.
anchors = {'entrance': [first-n]*3,
           'exit': [last, first+insert_frames-2*n, first+insert_frames-2*n-trim]}
records = []
half = round(.35*rate)
for name, starts in anchors.items():
    windows = [x[a-half:a+half] for (_, x), a in zip(loaded, starts)]
    assert all(len(x) == 2*half for x in windows)
    limit = max(.05, math.ceil(max(float(np.max(np.abs(x))) for x in windows)/.05)*.05)
    fig, axes = plt.subplots(3, 2, figsize=(15, 11), layout='constrained')
    fig.suptitle(f'Phrase {name}: frozen audio, aligned to boundary (0 ms)\n'
                 'Scales shared across rows; no loudness normalization\n'
                 'Green: reference boundary at 0 ms; edited rows shade the 0–5 ms crossfade', fontsize=15)
    row_records = []
    for row, (x, anchor, label) in enumerate(zip(windows, starts, labels)):
        times = np.arange(-half, half)*1000/rate
        ax = axes[row, 0]
        ax.plot(times, x, color='#145ca8', linewidth=.65)
        ax.set_ylim(-limit, limit)
        ax.set_ylabel('Amplitude (1 = full scale)')
        ax.set_title(f'{label}\nBoundary at output frame {anchor} ({anchor/rate:.6f} s)', fontsize=11)
        f, t, power = spectrogram(x.astype(np.float64), fs=rate, window='hann',
                                 nperseg=512, noverlap=448, detrend=False,
                                 scaling='density', mode='psd')
        spec = axes[row, 1]
        mesh = spec.pcolormesh((t-.35)*1000, f/1000,
                              10*np.log10(np.maximum(power, 1e-14)),
                              shading='nearest', cmap='magma', vmin=-110, vmax=-35)
        spec.set_ylim(0, 12)
        spec.set_ylabel('Frequency (kHz)')
        spec.set_title('Hann 512 samples / hop 64; 46.875 Hz bins', fontsize=11)
        for panel in (ax, spec):
            panel.set_xlim(-350, 350)
            panel.set_xlabel('Milliseconds relative to boundary')
            panel.axvline(0, color='#008f39', linewidth=1.4)
            if row:
                panel.axvspan(0, n*1000/rate, color='#00ff88', alpha=.18)
                panel.axvline(n*1000/rate, color='#008f39', linewidth=.8)
        row_records.append({'label': label, 'anchorFrame': anchor,
                            'windowFrames': [anchor-half, anchor+half],
                            'peak': float(np.max(np.abs(x))),
                            'rms': float(np.sqrt(np.mean(x.astype(np.float64)**2)))})
    fig.colorbar(mesh, ax=axes[:, 1], label='Power spectral density (dB re 1 full-scale²/Hz)', shrink=.8)
    fig.savefig(out/f'{name}.png', dpi=130)
    plt.close(fig)
    detail, detail_axes = plt.subplots(3, 1, figsize=(11, 8), layout='constrained')
    detail.suptitle(f'Phrase {name}: waveform transition detail\n'
                    'Green = 0 ms reference boundary; shaded 0–5 ms = edited crossfade', fontsize=14)
    for row, (x, label) in enumerate(zip(windows, labels)):
        ax = detail_axes[row]
        ax.plot(np.arange(-half, half)*1000/rate, x, color='#145ca8', linewidth=.8)
        ax.set(xlim=(-25, 25), ylim=(-limit, limit), title=label,
               xlabel='Milliseconds relative to boundary', ylabel='Amplitude (full scale)')
        ax.axvline(0, color='#008f39', linewidth=1.4)
        if row:
            ax.axvspan(0, n*1000/rate, color='#00ff88', alpha=.18)
            ax.axvline(n*1000/rate, color='#008f39', linewidth=.8)
    detail.savefig(out/f'{name}-detail.png', dpi=130)
    plt.close(detail)
    records.append({'boundary': name, 'amplitudeLimits': [-limit, limit], 'rows': row_records,
                    'previousCurrentWindowExact': bool(np.array_equal(windows[1], windows[2])),
                    'previousCurrentMaxAbsDifference': float(np.max(np.abs(windows[1].astype(float)-windows[2])))})
report = {'rate': rate, 'inputs': [{'path': str(p.relative_to(assets)),
          'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'frames': len(x)}
          for p, (_, x) in zip(paths, loaded)], 'transitionFrames': n,
          'removedEntranceFrames': trim, 'suffixExact': True,
          'suffixFrames': len(current)-first, 'boundaries': records,
          'scope': 'Frozen candidate timing and sample preservation only; no listening, phoneme boundary, voice identity or naturalness verdict.'}
(out/'measurements.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
