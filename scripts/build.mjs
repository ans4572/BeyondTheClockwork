// Packs the game's code for the published site (2026-11-14). From Korea the site is answered from Cloudflare's Los
// Angeles edge, about 0.7 s a request: checking the ~70 code files and 5 data files one by one took about 24 s on every
// visit, even when none had changed. Here they become a few files whose names carry their contents' hash (build/), kept
// a year without asking (_headers); only index.html is checked on each visit, and it names the new files after a deploy.
//
//   node scripts/build.mjs           writes build/ and index.built.html (open /index.built.html on the dev server to try it)
//   node scripts/build.mjs --deploy  on Cloudflare's build machine (wrangler.toml [build]): writes build/ and rewrites
//                                    index.html there. Anywhere else it does nothing, so a local `npx wrangler deploy`
//                                    uploads the plain files as before and the tracked index.html is never touched.
//
// The source stays plain ES modules: the dev server, the tests, admin.html and sounds.html use src/ directly.
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = 'build', DATA = ['combat', 'progression', 'slice', 'maps', 'dialogue'], STYLES = ['src/style.css', 'src/layout.css'];
const at = file => path.join(ROOT, file);
const hashOf = text => createHash('sha256').update(text).digest('hex').slice(0, 10);

/** Replaces `from` once in `text`; a missing match stops the build (the source changed under the build). */
export function replaceOnce(text, from, to, where) {
  const index = typeof from === 'string' ? text.indexOf(from) : text.search(from);
  if (index < 0) throw new Error(`build: ${where}: expected text not found (${from})`);
  return text.replace(from, () => to);
}

/** The source edits the bundle needs: paths that point next to a module must point into build/. */
export function siteEdits({ dataFiles, workers }) {
  return {
    // The six recipe files by a name list become plain imports, so they are packed in (sounds.html still busts the cache).
    'src/audio/sfx.js': text => {
      const list = /\[((?:\s*'[\w-]+',?)+)\]\.map\(name => import\(`\.\/\$\{name\}\.js\$\{QUERY\}`\)\)/;
      const names = [...(text.match(list)?.[1] || '').matchAll(/'([\w-]+)'/g)].map(([, name]) => name);
      if (!names.length) throw new Error('build: src/audio/sfx.js: recipe import list not found');
      const imports = names.map((name, i) => `import * as __recipe${i} from './${name}.js';`).join('\n');
      return `${imports}\n${replaceOnce(text, list, `[${names.map((_, i) => `__recipe${i}`).join(', ')}]`, 'src/audio/sfx.js')}`;
    },
    'src/engine/data.js': text => replaceOnce(text, 'fetch(`src/data/${name}.json`)', `fetch(${JSON.stringify(dataFiles)}[name])`, 'src/engine/data.js'),
    'src/render/grade.js': text => replaceOnce(text, "new URL('./grade-worker.js', import.meta.url)", `new URL('./${workers['grade-worker']}', import.meta.url)`, 'src/render/grade.js'),
    'src/render/map-loader.js': text => replaceOnce(text, "new URL('./depth-worker.js', import.meta.url)", `new URL('./${workers['depth-worker']}', import.meta.url)`, 'src/render/map-loader.js')
  };
}

/** index.html pointed at the packed files: one script, one style sheet, the data by its new names, no module list. */
export function builtHtml(html, { main, css, dataFiles }) {
  let out = html.replace(/\r\n/g, '\n');
  const modules = out.match(/^ *<link rel="modulepreload" href="src\/[^"]+">\n/gm) || [];
  if (modules.length < 10) throw new Error('build: index.html: the module preload list was not found');
  for (const line of modules) out = out.replace(line, '');
  for (const name of DATA) out = replaceOnce(out, `href="src/data/${name}.json"`, `href="${dataFiles[name]}"`, `index.html preload of ${name}.json`);
  out = replaceOnce(out, /<link rel="stylesheet" href="src\/style\.css">\n *<link rel="stylesheet" href="src\/layout\.css">/, `<link rel="modulepreload" href="${main}">\n  <link rel="stylesheet" href="${css}">`, 'index.html style sheets');
  return replaceOnce(out, '<script type="module" src="src/main.js"></script>', `<script type="module" src="${main}"></script>`, 'index.html script');
}

async function loadEsbuild(deploy) {
  try { return await import('esbuild'); }
  catch (error) {
    if (!deploy) throw new Error('build: esbuild is not installed: run npm install');
    // In case the build machine did not install the dev tools itself.
    execSync('npm ci --include=dev --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' });
    return import('esbuild');
  }
}

export async function buildSite({ deploy = false } = {}) {
  const esbuild = await loadEsbuild(deploy);
  await rm(at(OUT), { recursive: true, force: true });
  await mkdir(at(`${OUT}/data`), { recursive: true });
  const common = { bundle: true, format: 'esm', minify: true, sourcemap: 'linked', entryNames: '[name]-[hash]', outdir: at(OUT), metafile: true, logLevel: 'warning', legalComments: 'none' };
  const outputOf = (result, entry) => {
    const [file] = Object.entries(result.metafile.outputs).find(([, output]) => output.entryPoint?.replace(/\\/g, '/').endsWith(entry)) || [];
    if (!file) throw new Error(`build: no output for ${entry}`);
    return path.basename(file);
  };

  // The data, minified, under names that change with their contents.
  const dataFiles = {};
  for (const name of DATA) {
    const text = JSON.stringify(JSON.parse(await readFile(at(`src/data/${name}.json`), 'utf8')));
    const file = `${OUT}/data/${name}-${hashOf(text)}.json`;
    await writeFile(at(file), text); dataFiles[name] = file;
  }
  // The two workers first, so the main bundle can name them.
  const workerEntries = ['src/render/grade-worker.js', 'src/render/depth-worker.js'];
  const workerBuild = await esbuild.build({ ...common, entryPoints: workerEntries.map(at) });
  const workers = Object.fromEntries(workerEntries.map(entry => [path.basename(entry, '.js'), outputOf(workerBuild, entry)]));
  const edits = siteEdits({ dataFiles, workers }), edited = new Set();
  const site = {
    name: 'site',
    setup(build) {
      build.onLoad({ filter: /\.js$/ }, async args => {
        const file = path.relative(ROOT, args.path).replace(/\\/g, '/');
        if (!edits[file]) return undefined;
        edited.add(file);
        return { contents: edits[file](await readFile(args.path, 'utf8')), loader: 'js' };
      });
    }
  };
  const mainBuild = await esbuild.build({ ...common, entryPoints: [at('src/main.js')], plugins: [site] });
  for (const file of Object.keys(edits)) if (!edited.has(file)) throw new Error(`build: ${file} is no longer part of the game; update scripts/build.mjs`);
  const main = `${OUT}/${outputOf(mainBuild, 'src/main.js')}`;

  // Both style sheets as one; their url(../art/...) still points the right way from build/.
  const styles = (await Promise.all(STYLES.map(file => readFile(at(file), 'utf8')))).join('\n');
  if (/@import/.test(styles)) throw new Error('build: a style sheet uses @import; join it here first');
  const { code: cssCode } = await esbuild.transform(styles, { loader: 'css', minify: true });
  const css = `${OUT}/style-${hashOf(cssCode)}.css`;
  await writeFile(at(css), cssCode);

  const html = builtHtml(await readFile(at('index.html'), 'utf8'), { main, css, dataFiles });
  const page = deploy ? 'index.html' : 'index.built.html';
  await writeFile(at(page), html);
  const size = Object.values(mainBuild.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
  console.log(`build: ${main} (${Math.round(size / 1024)} KB with its source map), ${css}, ${DATA.length} data files → ${page}`);
  return { main, css, dataFiles, workers, page };
}

if (process.argv[1]?.endsWith('build.mjs')) {
  const deploy = process.argv.includes('--deploy');
  // Cloudflare's build machine sets WORKERS_CI. Elsewhere --deploy leaves everything as it is.
  if (deploy && !process.env.WORKERS_CI && !process.env.CI) console.log('build: not on the build machine, so the plain files are deployed as they are');
  else await buildSite({ deploy });
}
