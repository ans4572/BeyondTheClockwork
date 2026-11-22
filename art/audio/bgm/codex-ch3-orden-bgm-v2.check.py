"""Checks for the Orden BGM v2 task (codex-ch3-orden-bgm-v2.task.md).

    python codex-ch3-orden-bgm-v2.check.py <name>-score.json [<name>.wav]

The score part needs only the standard library; the audio part needs numpy and a wav (16/24/32-bit PCM or
float; decode the final ogg first: ffmpeg -i x.ogg x.wav). Exit code 1 when any check fails.

Score format: the one Codex wrote for v1 (beats_per_bar, notes[{channel, pitch, beat, duration, velocity}],
harmony[{bar, chord}], instruments[{channel, program, role}]). A harmony entry may also carry "beat"
(0-based beat inside the bar) when the chord changes inside a bar.
"""
import json, math, statistics as st, sys

PC = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
      'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11}
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
QUALITY = [('m7b5', [0, 3, 6, 10]), ('maj7', [0, 4, 7, 11]), ('m7', [0, 3, 7, 10]), ('sus4', [0, 5, 7]),
           ('sus2', [0, 2, 7]), ('dim', [0, 3, 6]), ('m', [0, 3, 7]), ('7', [0, 4, 7, 10]), ('', [0, 4, 7])]
UNPITCHED = {47, 116, 117, 118}          # timpani, taiko, melodic tom, synth drum: left out of the harmony checks
BELL = {14}                              # tubular bells

LIMITS = {
    'clashes': 6,            # sustained semitone / minor-ninth clashes between two parts, whole song
    'long_off_chord': 0.04,  # share of notes >= 1.5 beats that are not chord tones
    'bell_off_chord': 0,     # bell strikes that are not chord tones
    'velocity_sd': 6.0,      # per pitched part with >= 40 notes
    'off_grid': 0.30,        # share of notes off the exact 16th / triplet grid, per melodic part
    'dip_db': None,          # set per song below
    'seam_db': 5.0,          # last second vs first second (belgard-v2: 4.7)
    'centroid_hz': 1500.0,   # belgard-v2: 1174
}
DIP = {'orden-chamber': 13.0, 'orden-lasthour': 14.0}   # belgard-v2 measures 12.1 with this method


def chord_pcs(name):
    q = name.split('/')[0]
    root = q[:2] if len(q) > 1 and q[1] in '#b' else q[:1]
    rest = q[len(root):]
    iv = next(v for k, v in QUALITY if rest.startswith(k))
    pcs = {(PC[root] + i) % 12 for i in iv}
    if '/' in name: pcs.add(PC[name.split('/')[1]])
    return pcs


def score_checks(path):
    j = json.load(open(path, encoding='utf-8'))
    bpb = j['beats_per_bar']
    prog = {i['channel']: i['program'] for i in j['instruments']}
    pitched = lambda ch: ch != 9 and prog.get(ch) not in UNPITCHED
    harm = sorted(((h['bar'] - 1) * bpb + h.get('beat', 0), h['chord']) for h in j['harmony'])

    def chord_at(beat):
        cur = None
        for at, ch in harm:
            if at <= beat + 1e-6: cur = ch
            else: break
        return cur

    notes = [n for n in j['notes'] if pitched(n['channel'])]
    out, fails = [], []

    # 1. clashes
    sus = sorted((n for n in notes if n['duration'] >= 0.5), key=lambda n: n['beat'])
    clashes, ex = 0, []
    for i, a in enumerate(sus):
        for b in sus[i + 1:]:
            if b['beat'] >= a['beat'] + a['duration']: break
            ov = min(a['beat'] + a['duration'], b['beat'] + b['duration']) - b['beat']
            if ov >= 0.5 and a['channel'] != b['channel'] and abs(a['pitch'] - b['pitch']) % 12 in (1, 11):
                clashes += 1
                if len(ex) < 6: ex.append(f"bar {int(b['beat'] // bpb) + 1} ch{a['channel']} {NAMES[a['pitch'] % 12]} x ch{b['channel']} {NAMES[b['pitch'] % 12]}")
    out.append(('clashes', clashes, clashes <= LIMITS['clashes'], ex))

    # 2. long notes off the chord
    longs = [n for n in notes if n['duration'] >= 1.5 and chord_at(n['beat'])]
    off = [n for n in longs if n['pitch'] % 12 not in chord_pcs(chord_at(n['beat']))]
    share = len(off) / max(1, len(longs))
    out.append(('long_off_chord', round(share, 3), share <= LIMITS['long_off_chord'],
                [f"bar {int(n['beat'] // bpb) + 1} {chord_at(n['beat'])} ch{n['channel']} {NAMES[n['pitch'] % 12]}" for n in off[:6]]))

    # 3. bells on chord tones
    bells = [n for n in notes if prog.get(n['channel']) in BELL and chord_at(n['beat'])]
    boff = [n for n in bells if n['pitch'] % 12 not in chord_pcs(chord_at(n['beat']))]
    out.append(('bell_off_chord', len(boff), len(boff) <= LIMITS['bell_off_chord'],
                [f"bar {int(n['beat'] // bpb) + 1} {chord_at(n['beat'])} {NAMES[n['pitch'] % 12]}" for n in boff[:6]]))

    # 4-5. expression per part
    by = {}
    for n in notes: by.setdefault(n['channel'], []).append(n)
    for ch, xs in sorted(by.items()):
        if len(xs) < 40: continue
        sd = st.pstdev([n['velocity'] for n in xs])
        out.append((f'velocity_sd ch{ch}', round(sd, 1), sd >= LIMITS['velocity_sd'], []))
        if prog.get(ch) in (6, 7):  # harpsichord and clavi may stay exact: they are the clock
            continue
        grid = lambda b: min(abs(b * 4 - round(b * 4)) / 4, abs(b * 3 - round(b * 3)) / 3)
        og = sum(1 for n in xs if grid(n['beat']) > 0.006) / len(xs)
        out.append((f'off_grid ch{ch}', round(og, 2), og >= LIMITS['off_grid'], []))
    return j['name'], out


def audio_checks(name, wav):
    import struct
    import numpy as np
    raw = open(wav, 'rb').read()
    i, fmt, data = 12, None, None
    while i + 8 <= len(raw):
        cid, size = raw[i:i + 4], struct.unpack('<I', raw[i + 4:i + 8])[0]
        if cid == b'fmt ': fmt = struct.unpack('<HHIIHH', raw[i + 8:i + 24])
        if cid == b'data': data = raw[i + 8:i + 8 + size]
        i += 8 + size + (size & 1)
    tag, ch, sr, _, _, bits = fmt
    if tag == 0xFFFE: tag = 3 if bits == 32 and b'\x03\x00\x00\x00\x00\x00\x10\x00' in raw[:200] else 1
    if tag == 3: x = np.frombuffer(data, dtype=np.float32 if bits == 32 else np.float64).astype(np.float32)
    elif bits == 16: x = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768
    elif bits == 24:
        b = np.frombuffer(data, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        x = ((b[:, 0] | b[:, 1] << 8 | b[:, 2] << 16) << 8 >> 8).astype(np.float32) / 8388608
    else: x = np.frombuffer(data, dtype=np.int32).astype(np.float32) / 2147483648
    x = x[: len(x) // ch * ch].reshape(-1, ch).mean(axis=1)
    sec = x[: len(x) // sr * sr].reshape(-1, sr)
    rms = 20 * np.log10(np.sqrt((sec ** 2).mean(axis=1)) + 1e-9)
    dip = float(rms.max() - rms.min())
    seam = float(abs(rms[-1] - rms[0]))
    spec = np.abs(np.fft.rfft(sec * np.hanning(sr), axis=1))
    f = np.fft.rfftfreq(sr, 1 / sr)
    cen = float(np.average((spec * f).sum(axis=1) / (spec.sum(axis=1) + 1e-9), weights=spec.sum(axis=1)))
    lim = DIP.get(name, 10.0)
    return [('dip_db (max-min of 1 s RMS)', round(dip, 1), dip <= lim, [f'quietest at {int(rms.argmin())} s']),
            ('seam_db (last s vs first s)', round(seam, 1), seam <= LIMITS['seam_db'], []),
            ('centroid_hz', round(cen), cen <= LIMITS['centroid_hz'], [])]


if __name__ == '__main__':
    name, res = score_checks(sys.argv[1])
    if len(sys.argv) > 2: res += audio_checks(name, sys.argv[2])
    bad = 0
    print(name)
    for key, val, ok, ex in res:
        bad += not ok
        print(f"  {'PASS' if ok else 'FAIL'}  {key}: {val}" + (f"   e.g. {'; '.join(ex)}" if ex and not ok else ''))
    sys.exit(1 if bad else 0)
