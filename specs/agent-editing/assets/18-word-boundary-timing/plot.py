"""Calibrated views of frozen word splice metadata; never rewrite or audition audio."""
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import math
import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FormatStrFormatter

out = Path(__file__).resolve().parent
assets = out.parent
room = json.loads((assets/'18-voice-roomtone/report.json').read_text())
word = next(value for value in room['cases'] if value['id'] == 'word')
original_manifest = json.loads((assets/'18-voice/manifest.json').read_text())
context_start = original_manifest['config']['contextRange']['startUs']
phrase_evidence = json.loads((assets/'18-voice-boundary-timing/measurements.json').read_text())
original_hash = next(value['sha256'] for value in phrase_evidence['inputs']
                     if value['path'] == '18-voice/context.wav')
paths = [assets/'18-voice/context.wav', assets/'18-voice-roomtone/word-room-context.wav']
expected_hashes = [original_hash, word['outputs']['room']['sha256']]
sha = lambda data: hashlib.sha256(data).hexdigest()
for path, digest in zip(paths, expected_hashes):
    assert sha(path.read_bytes()) == digest
loaded = [wavfile.read(path) for path in paths]
assert all(rate == 24000 and data.ndim == 1 and data.dtype == np.float32
           and np.isfinite(data).all() for rate, data in loaded)
rate = 24000
original, current = [data for _, data in loaded]
first, last = [round(Fraction((time-context_start)*rate, 1_000_000))
               for time in word['replacedTimelineRangeUs']]
n = word['transitionSamples']
insert_frames = round((word['keptGeneratedSeconds'][1]-word['keptGeneratedSeconds'][0])*rate)
entrance = first-n
current_exit = first+insert_frames-2*n
original_suffix, current_suffix = last+n, current_exit+n
assert original[:entrance].tobytes() == current[:entrance].tobytes()
assert original[original_suffix:].tobytes() == current[current_suffix:].tobytes()
assert len(current) == word['outputs']['room']['frames']
assert len(current)-len(original) == current_suffix-original_suffix
labels = ['Original recorded context', 'Current frozen word + recorded hum']
records = []
plot_checks = []

# Same calibrated SciPy PSD recipe as the frozen phrase figures; no phrase script runs.
def spectrum(data):
    f, t, power = spectrogram(data.astype(np.float64), fs=rate, window='hann',
        nperseg=512, noverlap=448, detrend=False, scaling='density', mode='psd')
    return f/1000, (t-.35)*1000, 10*np.log10(np.maximum(power, 1e-14))

def markers(ax, edited, half_ms):
    ax.set_xlim(-half_ms, half_ms)
    ax.axvline(0, color='#008f39', linewidth=1.3)
    ax.axvline(n*1000/rate, color='#008f39', linewidth=1, linestyle='--')
    if edited:
        ax.axvspan(0, n*1000/rate, color='#00ff88', alpha=.18)
    ax.set_xlabel('Milliseconds relative to marked boundary')

def clock_label(row, anchor, original_anchor):
    local = anchor/rate
    source = context_start/1e6+original_anchor/rate
    if row == 0:
        return f'Context frame {anchor:,} = {local:.6f} s; source {source:.6f} s'
    return f'Output frame {anchor:,} = {local:.6f} s; source join reference {source:.6f} s'

def verify_figure(fig, groups, name):
    fig.set_dpi(140)
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    width, height = fig.canvas.get_width_height()
    text = [fig._suptitle]
    for ax in fig.axes:
        text.extend([ax.title, ax.xaxis.label, ax.yaxis.label])
    bounds = [artist.get_window_extent(renderer) for artist in text if artist.get_text()]
    assert all(box.x0 >= 0 and box.y0 >= 0 and box.x1 <= width and box.y1 <= height
               for box in bounds), 'Figure text leaves the canvas'
    axes_records = []
    for group in groups:
        first_axis = group[0]
        for ax in group[1:]:
            assert ax.get_xlim() == first_axis.get_xlim()
            assert ax.get_ylim() == first_axis.get_ylim()
            assert np.array_equal(ax.get_xticks(), first_axis.get_xticks())
            assert np.array_equal(ax.get_yticks(), first_axis.get_yticks())
            assert abs(ax.get_position().width-first_axis.get_position().width) < 1e-10
        axes_records.append({'xLimits': list(first_axis.get_xlim()),
            'yLimits': list(first_axis.get_ylim()), 'rowWidthsEqual': True})
    plot_checks.append({'file': name, 'pixels': [width, height],
        'titlesAndAxisLabelsWithinCanvas': True, 'matchingRowAxes': axes_records})

for boundary, anchors in [('entrance', [entrance, entrance]), ('exit', [last, current_exit])]:
    half = 8400
    windows = [data[anchor-half:anchor+half] for (_, data), anchor in zip(loaded, anchors)]
    assert all(len(data) == 2*half for data in windows)
    limit = max(.05, math.ceil(max(float(np.max(np.abs(x))) for x in windows)/.05)*.05)
    details = [data[half-600:half+600] for data in windows]
    detail_limit = math.ceil(max(float(np.max(np.abs(x))) for x in details)*1.1/.005)*.005
    exact = 'before 0 ms' if boundary == 'entrance' else 'after 5 ms'
    caption = (f'Green solid = 0 ms; dashed = 5 ms. Only the edited row shades the crossfade. '
               f'Source context is sample-exact {exact}.')
    fig, axes = plt.subplots(2, 2, figsize=(15, 8.5), layout='constrained')
    fig.suptitle(f'Word {boundary}: original and current frozen candidate\n'
                 f'Waveform scale ±{limit:.3f} full scale and spectral scale shared across rows\n'
                 +caption, fontsize=12)
    rows = []
    for row, (data, anchor, label) in enumerate(zip(windows, anchors, labels)):
        waveform, spectral = axes[row]
        waveform.plot(np.arange(-half, half)*1000/rate, data, color='#145ca8', linewidth=.65)
        waveform.set_ylim(-limit, limit)
        waveform.set_ylabel('Amplitude (1 = full scale)')
        waveform.set_title(label+'\n'+clock_label(row, anchor, anchors[0]), fontsize=10)
        waveform.yaxis.set_major_formatter(FormatStrFormatter('%.3f'))
        frequencies, times, power = spectrum(data)
        mesh = spectral.pcolormesh(times, frequencies, power, shading='nearest',
            cmap='magma', vmin=-110, vmax=-35)
        spectral.set_ylim(0, 12)
        spectral.set_ylabel('Frequency (kHz)')
        spectral.set_title(label+'\nHann 512 samples / hop 64; 46.875 Hz bins', fontsize=10)
        for ax in (waveform, spectral):
            markers(ax, row == 1, 350)
        rows.append({'label': label, 'anchorFrame': anchor, 'localTimeSeconds': anchor/rate,
            'correspondingSourceTimeSeconds': context_start/1e6+anchors[0]/rate,
            'windowFrames': [anchor-half, anchor+half],
            'windowPCMsha256': sha(data.tobytes()), 'peak': float(np.max(np.abs(data))),
            'rms': float(np.sqrt(np.mean(data.astype(np.float64)**2)))})
    fig.colorbar(mesh, ax=axes[:, 1], label='Power density (dB re 1 full-scale²/Hz)', shrink=.8)
    verify_figure(fig, [axes[:, 0], axes[:, 1]], f'{boundary}.png')
    fig.savefig(out/f'{boundary}.png', dpi=140)
    plt.close(fig)
    detail, axes = plt.subplots(2, 1, figsize=(13, 6.5), layout='constrained')
    detail.suptitle(f'Word {boundary}: ±25 ms waveform detail\n'
        f'Detail amplitude scale ±{detail_limit:.3f} full scale, shared across rows '
        f'(overview: ±{limit:.3f})\n'+caption, fontsize=11)
    for row, (data, anchor, label) in enumerate(zip(details, anchors, labels)):
        ax = axes[row]
        ax.plot(np.arange(-600, 600)*1000/rate, data, color='#145ca8', linewidth=.85)
        ax.set_ylim(-detail_limit, detail_limit)
        ax.set_ylabel('Amplitude (1 = full scale)')
        ax.set_title(label+'\n'+clock_label(row, anchor, anchors[0]), fontsize=10)
        ax.yaxis.set_major_formatter(FormatStrFormatter('%.3f'))
        markers(ax, row == 1, 25)
    verify_figure(detail, [axes], f'{boundary}-detail.png')
    detail.savefig(out/f'{boundary}-detail.png', dpi=140)
    plt.close(detail)
    records.append({'boundary': boundary, 'amplitudeLimits': [-limit, limit],
        'detailAmplitudeLimits': [-detail_limit, detail_limit], 'rows': rows})
report = {'sampleRate': rate, 'sourceContextStartUs': context_start,
    'sourceOriginUsAlreadyAppliedAtExtraction': original_manifest['config']['sourceOriginUs'],
    'declaredReplacementSourceRangeUs': word['replacedTimelineRangeUs'],
    'roundedOriginalCutFrames': [first, last], 'transitionFrames': n,
    'insertFrames': insert_frames, 'outputDurationChangeFrames': len(current)-len(original),
    'prefixExact': {'frames': entrance, 'sha256': sha(original[:entrance].tobytes())},
    'suffixExact': {'originalStartFrame': original_suffix, 'currentStartFrame': current_suffix,
                    'frames': len(original)-original_suffix,
                    'sha256': sha(original[original_suffix:].tobytes())},
    'inputs': [{'path': str(path.relative_to(assets)), 'sha256': sha(path.read_bytes()),
                'frames': len(data)} for path, (_, data) in zip(paths, loaded)],
    'metadata': {str(path.relative_to(assets)): sha(path.read_bytes()) for path in
        [assets/'18-voice-roomtone/report.json', assets/'18-voice/manifest.json',
         assets/'18-voice-boundary-timing/measurements.json']},
    'spectrum': {'windowFrames': 512, 'hopFrames': 64, 'window': 'hann',
                 'scaling': 'one-sided power density', 'displayDbLimits': [-110, -35]},
    'boundaries': records, 'plotChecks': plot_checks,
    'sourceCutQuantizationUs': [float(Fraction(frame*1_000_000, rate)+context_start-time)
        for frame, time in zip([first, last], word['replacedTimelineRangeUs'])],
    'scope': 'Frozen word edit-coordinate timing and exact context preservation only; no phoneme labels, listening, intelligibility, identity or naturalness verdict.'}
(out/'measurements.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
