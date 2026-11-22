import json, sys, statistics as st
dirs = sys.argv[1:]; ev = [json.load(open(f'{d}/eval.json')) for d in dirs]
ks = sorted(ev[-1])
for k in ks: print(f"{k:20} " + ' | '.join(f"z {e[k]['z']:5} r {e[k]['p_real']:.2f}" for e in ev) + f"  {ev[-1][k]['like']}")
for d, e in zip(dirs, ev): print(d, 'mean z', round(st.mean(e[k]['z'] for k in ks), 2), 'mean real', round(st.mean(e[k]['p_real'] for k in ks), 3), '>=2.5:', sum(e[k]['z'] >= 2.5 for k in ks), '>=2:', sum(e[k]['z'] >= 2 for k in ks))
