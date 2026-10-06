"""Bounded normalized-waveform research; evidence never declares an angle clock."""
import numpy as np

POLICY = {"centersSeconds": [3, 10, 17], "seconds": 4, "minimumCorrelation": .35,
          "maximumAlternativeRatio": .8, "alternativeSeparationMs": 50, "maximumSpreadMs": 2}

def peaks(template, signal, sample_rate, offset_origin_frames=0):
    a, b = np.asarray(template, dtype=np.float64), np.asarray(signal, dtype=np.float64)
    if (type(sample_rate) is not int or not 0 < sample_rate <= 48000 or
        type(offset_origin_frames) is not int or a.ndim != 1 or b.ndim != 1 or
        not 0 < len(a) <= 20 * sample_rate or not len(a) <= len(b) <= 2400 * sample_rate or
        not np.isfinite(a).all() or not np.isfinite(b).all()):
        raise ValueError('Supply complete finite mono template and bounded search signal')
    a = a.copy()
    a -= a.mean()
    width = len(a)
    exclusion = max(1, int(sample_rate * POLICY['alternativeSeparationMs'] / 1000))
    sums = np.concatenate(([0.], np.cumsum(b)))
    powers = np.concatenate(([0.], np.cumsum(b*b)))
    nfft = 1 << (len(a) + len(b) - 2).bit_length()
    numerator = np.fft.irfft(np.fft.rfft(b, nfft) * np.fft.rfft(a[::-1], nfft), nfft)[width-1:len(b)]
    variance = powers[width:] - powers[:-width] - (sums[width:] - sums[:-width])**2 / width
    denominator = np.sqrt(np.maximum(0, variance) * np.dot(a,a))
    scores = np.divide(numerator, denominator, out=np.zeros_like(numerator), where=denominator > 0)
    rankings = np.abs(scores).copy()
    result = []
    for _ in range(8):
        i = int(np.argmax(rankings))
        if not np.isfinite(rankings[i]) or rankings[i] <= 0: break
        result.append({"offsetFrames":i+offset_origin_frames,"correlation":float(scores[i]),"absoluteCorrelation":float(abs(scores[i]))})
        rankings[max(0,i-exclusion):min(len(rankings),i+exclusion+1)] = -np.inf
    return result

def estimate(left, right, sample_rate, max_lag_seconds=1):
    left, right = np.asarray(left, dtype=np.float64), np.asarray(right, dtype=np.float64)
    if (not isinstance(sample_rate, int) or sample_rate <= 0 or sample_rate > 48000 or
        left.ndim != 1 or right.ndim != 1 or len(left) != len(right) or
        len(left) != 20 * sample_rate or not np.isfinite(left).all() or not np.isfinite(right).all() or
        not np.isfinite(max_lag_seconds) or not 0 < max_lag_seconds <= 1):
        raise ValueError('Supply complete matched20s mono finite arrays and a bounded explicit lag')
    lag = int(sample_rate * max_lag_seconds)
    width = POLICY['seconds'] * sample_rate
    anchors = []
    for center in POLICY['centersSeconds']:
        start = (center - POLICY['seconds'] // 2) * sample_rate
        a = left[start:start + width]
        b = right[start - lag:start + width + lag]
        candidates = peaks(a, b, sample_rate, -lag)
        best = candidates[0] if candidates else None
        ratio = candidates[1]['absoluteCorrelation']/best['absoluteCorrelation'] if len(candidates)>1 else None
        admitted = bool(best and best['absoluteCorrelation'] >= POLICY['minimumCorrelation'] and
                        (ratio is None or ratio <= POLICY['maximumAlternativeRatio']))
        anchors.append({"centerFrames":center*sample_rate,"rangeFrames":[start,start+width],
                        "selectedFrames":best['offsetFrames'] if admitted else None,
                        "alternatives":candidates,"alternativeRatio":ratio})
    complete = all(a['selectedFrames'] is not None for a in anchors)
    spread = max(a['selectedFrames'] for a in anchors)-min(a['selectedFrames'] for a in anchors) if complete else None
    stable = complete and spread <= sample_rate * POLICY['maximumSpreadMs'] / 1000
    return {"state":"constant-offset" if stable else "unsuitable",
            "reason":None if stable else 'nonconstant-offset' if complete else 'insufficient-or-ambiguous-shared-waveform',
            "offsetFrames":sorted(a['selectedFrames'] for a in anchors)[1] if stable else None,
            "sampleRate":sample_rate,"spreadFrames":spread,"anchors":anchors,
            "mapping":"rightTime = leftTime + offsetFrames/sampleRate","policy":POLICY}
