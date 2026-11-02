import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = async p => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const source = await read('docs/design/clockwork-design.v1.json');
const slice = await read('src/data/slice.json');
const ids = slice.elements;
const provenance = { schemaVersion: 1, source: 'docs/design/clockwork-design.v1.json', contentVersion: source.contentVersion };
const outputs = {
  'combat.json': { ...provenance, units: source.units, player: source.player, caps: source.caps, balance: source.balance, elements: source.elements.filter(e => ids.includes(e.id)), skills: source.skills.filter(e => ids.includes(e.element)), fusions: source.fusions.filter(f => f.pair.every(e => ids.includes(e))), statuses: source.statuses.filter(s => source.elements.some(e => ids.includes(e.id) && e.status === s.id)), bosses: source.bosses.filter(b => slice.bosses.includes(b.id)) },
  'progression.json': { ...provenance, economy: source.economy, intro: source.intro, region: source.regions[0], run: source.run }
};
await mkdir(new URL('src/data/', root), { recursive: true });
for (const [name, value] of Object.entries(outputs)) {
  const expected = JSON.stringify(value, null, 2) + '\n';
  const url = new URL('src/data/' + name, root);
  if (process.argv.includes('--check')) {
    if (await readFile(url, 'utf8') !== expected) throw new Error(`${name} is stale. Run npm run data:sync.`);
  } else await writeFile(url, expected);
  console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${fileURLToPath(url)}`);
}
