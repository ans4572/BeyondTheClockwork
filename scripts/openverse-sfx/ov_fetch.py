# Stage 1: search Openverse (CC0 / CC BY, under 30 s) for each sound and download up to 6 candidates.
import json, os, sys, time, urllib.parse, requests
S = os.path.dirname(os.path.abspath(__file__))
DL = os.path.join(S, 'ov-dl')
UA = {'User-Agent': 'game-sfx-preview/1.0'}
spec = json.load(open(os.path.join(S, 'ov_spec.json'), encoding='utf-8'))
only = set(sys.argv[1:])
calls = 0

def search(q):
    global calls
    url = 'https://api.openverse.org/v1/audio/?' + urllib.parse.urlencode(
        {'q': q, 'license': 'cc0,by', 'length': 'shortest', 'page_size': 12, 'mature': 'false'})
    for attempt in range(3):
        r = requests.get(url, headers=UA, timeout=30); calls += 1; time.sleep(3.5)
        if r.status_code == 429: print('429, waiting'); time.sleep(30); continue
        r.raise_for_status(); return r.json().get('results', [])
    return []

for sid, queries, desc, cap in spec:
    if only and sid not in only: continue
    d = os.path.join(DL, sid); os.makedirs(d, exist_ok=True)
    meta_path = os.path.join(d, 'meta.json')
    if os.path.exists(meta_path) and not only: continue
    picked, seen = [], set()
    for q in queries:
        for r in search(q):
            if r['id'] in seen: continue
            dur = (r.get('duration') or 0) / 1000
            if dur and dur > 20: continue
            if (r.get('filetype') or '').lower() not in ('mp3', 'wav', 'ogg', 'flac', ''): continue
            seen.add(r['id']); picked.append(dict(r, query=q))
        if len(picked) >= 6: break
    got = []
    for n, r in enumerate(picked[:6]):
        ext = (r.get('filetype') or os.path.splitext(urllib.parse.urlparse(r['url']).path)[1][1:] or 'mp3').lower()
        path = os.path.join(d, f'{n}.{ext}')
        try:
            resp = requests.get(r['url'], headers=UA, timeout=60, stream=True); resp.raise_for_status()
            data = b''
            for chunk in resp.iter_content(65536):
                data += chunk
                if len(data) > 4_000_000: raise ValueError('too big')
            open(path, 'wb').write(data)
        except Exception as e:
            print(sid, n, 'skip', e); continue
        got.append({'file': os.path.basename(path), 'id': r['id'], 'title': r.get('title'), 'creator': r.get('creator'),
                    'license': r.get('license'), 'license_version': r.get('license_version'), 'license_url': r.get('license_url'),
                    'landing': r.get('foreign_landing_url'), 'provider': r.get('provider'), 'duration': r.get('duration'), 'query': r['query']})
    json.dump(got, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(sid, len(got), 'calls', calls, flush=True)
print('done, API calls', calls)
