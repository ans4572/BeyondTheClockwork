# Stage 2: for each sound, rank its Openverse candidates with earshot, find the best moment in the top three,
# cut it (short fades), make it mono 44.1 kHz, level it (loudest 300 ms RMS = 0.1, peak under 0.95) and write an ogg.
import json, os, sys
import numpy as np, soundfile as sf, soxr
import earshot.audio as ea
# No ffmpeg here: decode through soundfile (libsndfile reads wav / ogg / flac / mp3) inside this script only.
def _sf_decode(path, sr, ch):
    x, r0 = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if r0 != sr: x = soxr.resample(x, r0, sr).astype(np.float32)
    return np.repeat(x[:, None], 2, axis=1) if ch == 2 else x
ea._decode = _sf_decode
ea._src_channels = lambda path: sf.info(path).channels
ea.probe = lambda path: {'codec': 'pcm', 'sample_rate': sf.info(path).samplerate, 'channels': sf.info(path).channels,
                         'duration': sf.info(path).duration, 'has_video': False}
from earshot.search import rank, find

S = os.path.dirname(os.path.abspath(__file__))
DL = os.path.join(S, 'ov-dl')
OUT = r'C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\art\chapters\3-clock-tower\sfx-preview\openverse'
os.makedirs(OUT, exist_ok=True)
spec = json.load(open(os.path.join(S, 'ov_spec.json'), encoding='utf-8'))
only = set(sys.argv[1:])
man_path = os.path.join(OUT, 'manifest.json')
manifest = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {}
SR, TARGET = 44100, 0.1

def loud(x):
    w = int(SR * 0.3)
    if len(x) <= w: return float(np.sqrt(np.mean(x * x)))
    c = np.concatenate([[0], np.cumsum(x * x)])
    return float(np.sqrt((c[w:] - c[:-w]).max() / w))

def read(path):
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    return soxr.resample(x, sr, SR) if sr != SR else x

order = {'strong': 3, 'plausible': 2, 'weak': 1, 'no match': 0}
for sid, queries, desc, cap in spec:
    if only and sid not in only: continue
    d = os.path.join(DL, sid); mp = os.path.join(d, 'meta.json')
    if not os.path.exists(mp): print(sid, 'no downloads'); continue
    meta = {m['file']: m for m in json.load(open(mp, encoding='utf-8'))}
    if not meta: print(sid, 'no candidates'); continue
    # earshot reads mp3 only through ffmpeg (missing here): decode each candidate to a mono wav first.
    wd = os.path.join(S, 'ov-wav', sid); os.makedirs(wd, exist_ok=True); wav_of = {}
    for f in meta:
        w = os.path.join(wd, os.path.splitext(f)[0] + '.wav')
        try:
            if not os.path.exists(w): sf.write(w, read(os.path.join(d, f))[:SR * 20], SR, subtype='PCM_16')
            wav_of[os.path.basename(w)] = f
        except Exception as e: print(sid, f, 'unreadable', e)
    try:
        ranked = rank([os.path.join(wd, w) for w in wav_of], desc)['results']
    except Exception as e:
        print(sid, 'rank failed', e); continue
    best = None
    for r in ranked[:3]:
        if r['near_silent']: continue
        try: segs = find(r['path'], desc, top=5)['segments']
        except Exception as e: print(sid, 'find failed', r['name'], e); continue
        for s in segs:
            length = s['end'] - s['start']
            if length < 0.08: continue
            score = s['z'] - (0.6 if s.get('cut') else 0) - (0.3 if length > cap * 1.5 else 0)
            if not best or score > best[0]: best = (score, r, s)
    if not best: print(sid, 'nothing usable'); continue
    _, r, s = best
    x = read(r['path'])
    a = max(0, int(s['start'] * SR)); b = min(len(x), int(min(s['end'], s['start'] + cap) * SR))
    # Let the tail ring out: carry the end on while the sound is still above -40 dB of its peak (up to the cap).
    lim = min(len(x), a + int(cap * SR)); pk = float(np.abs(x[a:b]).max()) if b > a else 0
    while b + 441 <= lim and np.sqrt(np.mean(x[b:b + 441] ** 2)) > pk * 0.01: b += 441
    y = x[a:b].copy()
    fi, fo = min(len(y) // 4, int(0.004 * SR)), min(len(y) // 3, int(0.04 * SR))
    y[:fi] *= np.linspace(0, 1, fi); y[len(y) - fo:] *= np.linspace(1, 0, fo)
    g = TARGET / max(loud(y), 1e-6)
    peak = float(np.abs(y).max()) * g
    if peak > 0.95: g *= 0.95 / peak
    y = (y * g).astype('float32')
    name = f'{sid}-ov1.ogg'
    sf.write(os.path.join(OUT, name), y, SR, format='OGG', subtype='VORBIS')
    m = meta[wav_of[r['name']]]
    manifest[sid] = {'file': name, 'loud': round(loud(y), 5), 'seconds': round(len(y) / SR, 3),
                     'z': s['z'], 'verdict': s['verdict'], 'cut': s.get('cut'), 'from': [round(s['start'], 3), round(s['end'], 3)],
                     'title': m['title'], 'creator': m['creator'], 'license': m['license'], 'license_version': m['license_version'],
                     'license_url': m['license_url'], 'landing': m['landing'], 'provider': m['provider'], 'query': m['query'], 'desc': desc}
    print(f"{sid}: z {s['z']} {s['verdict']} {len(y)/SR:.2f}s '{m['title']}' ({m['license']}, {m['provider']})", flush=True)
    json.dump(manifest, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('done')
