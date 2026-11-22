# cave.py <dir>...: how cave-like each render is: the time from the peak until the sound has fallen 30 dB (50 ms RMS
# frames), and the earshot z for "a sound echoing in a large cave". Prints the mean per folder and the worst five.
import os, sys, json
import numpy as np, soundfile as sf, soxr
import earshot.audio as ea
def _sf_decode(path, sr, ch):
    x, r0 = sf.read(path, dtype='float32', always_2d=True); x = x.mean(axis=1)
    if r0 != sr: x = soxr.resample(x, r0, sr).astype(np.float32)
    return np.repeat(x[:, None], 2, axis=1) if ch == 2 else x
ea._decode = _sf_decode
ea._src_channels = lambda p: sf.info(p).channels
ea.probe = lambda p: {'codec': 'pcm', 'sample_rate': sf.info(p).samplerate, 'channels': sf.info(p).channels, 'duration': sf.info(p).duration, 'has_video': False}
from earshot.match import match
S = os.path.dirname(os.path.abspath(__file__))
Q = 'a sound echoing in a large cave'
for d in sys.argv[1:]:
    D = os.path.join(S, d); rows = {}
    for f in sorted(os.listdir(D)):
        if not f.endswith('.wav'): continue
        x, sr = sf.read(os.path.join(D, f), dtype='float32'); w = int(sr * 0.05)
        env = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) + 1e-9 for i in range(0, len(x) - w, w // 2)])
        p = int(env.argmax()); db = 20 * np.log10(env / env[p]); after = np.where(db[p:] < -30)[0]
        t30 = (after[0] if len(after) else len(db) - p) * (w // 2) / sr
        rows[f[:-4]] = (round(t30, 2), match(os.path.join(D, f), Q)['z'])
    print(d, 'mean t30', round(np.mean([r[0] for r in rows.values()]), 2), 's, mean cave z', round(np.mean([r[1] for r in rows.values()]), 2))
    print('  most cave-like:', ', '.join(f'{k} ({v[0]} s, z {v[1]})' for k, v in sorted(rows.items(), key=lambda kv: -kv[1][1])[:5]))
    json.dump(rows, open(os.path.join(D, 'cave.json'), 'w'))
