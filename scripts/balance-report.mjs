// Runs the input-only bot over every element pair and over tuning levels, and prints one table per question.
// node scripts/balance-report.mjs [seeds]   (default 12 seeds per row)
import { readFile } from 'node:fs/promises';
import { playtest } from './playtest.mjs';
import { statCost } from '../src/engine/progression.js';

const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8'));
const SEEDS = Array.from({ length: Number(process.argv[2]) || 12 }, (_, i) => 1000 + i * 37);
const PAIRS = [['fire', 'ice'], ['fire', 'lightning'], ['fire', 'wind'], ['ice', 'lightning'], ['ice', 'wind'], ['lightning', 'wind']];
const STATS = slice.permanentStats;

function row(label, options) {
  const runs = SEEDS.map(seed => playtest(seed, 600, options)), done = runs.filter(r => r.mode === 'complete');
  const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  return { label, clear: `${done.length}/${runs.length}`, seconds: Math.round(mean(done.map(r => r.seconds))), damage: Math.round(mean(runs.map(r => r.damageTaken))), reached: mean(runs.map(r => r.node)).toFixed(1) };
}
const print = (title, rows) => { console.log(`\n## ${title}\n| | 완주 | 완주 시간(초) | 받은 피해 | 평균 도달 구간 |\n|---|---|---|---|---|`); for (const r of rows) console.log(`| ${r.label} | ${r.clear} | ${r.seconds} | ${r.damage} | ${r.reached} |`); };

print('속성 조합 (영구 강화 없음)', PAIRS.map(pair => row(pair.join('+'), { loadout: pair })));
const all = rank => Object.fromEntries(STATS.map(stat => [stat.id, rank]));
print('전체 조율 단계 (불+얼음)', [0, 5, 10, 20].map(rank => row(`전부 ${rank}단계`, { stats: all(rank) })));
print('한 능력만 20단계 (불+얼음)', STATS.map(stat => row(stat.name, { stats: { [stat.id]: 20 } })));
const total = stat => Array.from({ length: stat.maxRank }, (_, rank) => statCost(stat, rank)).reduce((a, b) => a + b, 0);
console.log(`\n한 능력 20단계 비용 ${total(STATS[0])}, 전체 ${STATS.reduce((sum, stat) => sum + total(stat), 0)}`);
