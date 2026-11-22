# bosseval.py <dir> [ids...]: score each rendered boss sound: earshot match z for its description, p_real (does it
# sound like a recording), and CLAP cosine to the Openverse recording picked for it. Writes <dir>/eval.json.
import json, os, sys
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
from earshot.realness import realness
from earshot import vocab

S = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(S, sys.argv[1]); only = set(sys.argv[2:])
OV = r'C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\art\chapters\3-clock-tower\sfx-preview\openverse'
spec = {s[0]: s[2] for s in json.load(open(os.path.join(S, 'ov_spec.json'), encoding='utf-8'))}
page = {'boss-ttPendulum': 'boss-ttPendulumBlast', 'boss-ttFlank': 'boss-ttFlankWall'}
out_path = os.path.join(D, 'eval.json')
out = json.load(open(out_path)) if os.path.exists(out_path) else {}
for f in sorted(os.listdir(D)):
    if not f.endswith('.wav'): continue
    rid = f[:-4]
    if only and rid not in only: continue
    pid = page.get(rid, rid); desc = spec.get(pid)
    p = os.path.join(D, f); row = {}
    if desc:
        m = match(p, desc); row.update(desc=desc, z=m['z'], verdict=m['verdict'], like=[c['term'] for c in m['closest_vocab'][:2]])
    try:
        r = realness(p); row['p_real'] = round(float(r.get('p_real', r.get('probability', float('nan')))), 3)
    except Exception as e: row['p_real'] = None
    ref = os.path.join(OV, f'{pid}-ov1.ogg')
    if os.path.exists(ref):
        A = vocab.embed_files([p, ref]); row['cos_ref'] = round(float(A[0] @ A[1]), 3)
    out[rid] = row
    print(f"{rid:22} z {row.get('z')!s:5} {row.get('verdict','')!s:9} real {row.get('p_real')!s:5} ref {row.get('cos_ref')!s:5} like {row.get('like')}", flush=True)
json.dump(out, open(out_path, 'w'), indent=1)
