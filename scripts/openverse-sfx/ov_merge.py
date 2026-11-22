# Put each coded sound's in-game level (coded-levels.json, measured in the browser) into the manifest as target.
import json, os
S = os.path.dirname(os.path.abspath(__file__))
OUT = r'C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\art\chapters\3-clock-tower\sfx-preview\openverse\manifest.json'
levels = json.load(open(os.path.join(S, 'coded-levels.json')))
m = json.load(open(OUT, encoding='utf-8'))
for sid, take in m.items():
    take['target'] = levels.get(sid)
    if take['target'] is None: print('no level for', sid)
json.dump(dict(sorted(m.items())), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(m), 'takes')
for sid, t in m.items(): print(f"{sid:24} {t['verdict']:9} z {t['z']:5} {t['seconds']:5}s {t['license']:3} {t['title'][:50]}")
