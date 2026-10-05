/* Build: bundle JS + produce the three upload packages in /release.
   Run from repo root:  npm i && npm run build
   Outputs:
     sarodi-landing/assets/js/sarodi.bundle.js   (used by the WP plugin + static site)
     sarodi-landing/index.html                   (local preview)
     release/sarodi-landing-wp-plugin.zip         (WordPress: Plugins > Add New > Upload)
     release/sarodi-landing-static.zip            (any host: unzip into public_html/<folder>)
     release/sarodi-landing-single.html           (one self-contained file, no other assets)
   Optional: ARTIFACT_OUT=<path> also writes a skeleton-less body for a hosted preview. */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const rel = join(repo, 'release');
const read = p => readFileSync(join(here, p), 'utf8');
const b64 = p => readFileSync(join(here, p)).toString('base64');

await build({
  entryPoints: [join(here, 'src/js/main.js')],
  bundle: true, format: 'iife', minify: true, target: 'es2020',
  legalComments: 'eof', outfile: join(here, 'assets/js/sarodi.bundle.js'), logLevel: 'warning',
});
const bundle = read('assets/js/sarodi.bundle.js');

const TITLE = 'کلید هوشمند سارودی | Sarodi Smart Switch';
const DESC = 'کلید هوشمند لمسی وای‌فای سارودی با پنل شیشه‌ای ۸۶×۸۶، تا ۲۲۰۰ وات برای هر پل؛ مدل‌های یک تا چهار پل، پرده برقی و کولر آبی. کنترل از موبایل و سناریوهای هوشمند.';
const fill = (html, A) => html.replaceAll('{{A}}', A).replaceAll('{{CTA}}', '#slp-contact').replaceAll('{{TEL}}', 'tel:03133120').replaceAll('{{CLS}}', '');
const tpl = read('templates/landing.html');
const head = extra => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#05090b">
${extra}
<style>:root{color-scheme:dark;background:#05090b}html,body{margin:0;background:#05090b}</style>`;

/* 1) static site (index.html + assets) */
const page = (headExtra, body) => `<!doctype html>\n<html lang="fa" dir="rtl">\n<head>\n${head(headExtra)}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const staticHtml = page(
  '<link rel="preload" href="assets/fonts/Vazirmatn-wght.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="assets/css/landing.css">',
  fill(tpl, 'assets'));
writeFileSync(join(here, 'index.html'), staticHtml);

/* 2) single self-contained file */
const font = `url(data:font/woff2;base64,${b64('assets/fonts/Vazirmatn-wght.woff2')}) format("woff2")`;
const css = read('assets/css/landing.css').replace(/src:\s*url\("\.\.\/fonts\/Vazirmatn-wght\.woff2"\)[^;]*;/, `src: ${font};`);
let inl = fill(tpl, '__A__')
  .replace(/__A__\/img\/([\w-]+\.svg)/g, (_, f) => `data:image/svg+xml;base64,${b64('assets/img/' + f)}`);
const safeJs = bundle.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
inl = inl.replace(/<script defer src="__A__\/js\/sarodi\.bundle\.js"><\/script>/, () => `<script>${safeJs}</script>`); // function form: bundle text may contain $' / $& patterns
if (inl.includes('__A__')) throw new Error('unresolved asset path in single-file build');
const singleBody = `<style>${css}</style>\n${inl}`;

/* 3) release packages */
rmSync(rel, { recursive: true, force: true }); mkdirSync(rel, { recursive: true });
writeFileSync(join(rel, 'sarodi-landing-single.html'), page('', singleBody));
if (process.env.ARTIFACT_OUT) writeFileSync(process.env.ARTIFACT_OUT, `<title>Sarodi Smart Switch</title>\n<style>:root{color-scheme:dark;background:#05090b}body{background:#05090b}</style>\n${singleBody}\n`);

const tmp = join(rel, '_tmp'); mkdirSync(tmp);
// WP plugin: only runtime files (no sources/build tooling)
const wp = join(tmp, 'sarodi-landing'); mkdirSync(wp);
for (const f of ['sarodi-landing.php', 'README.md', 'templates', 'assets']) cpSync(join(here, f), join(wp, f), { recursive: true });
// static site
const st = join(tmp, 'sarodi-static'); mkdirSync(st);
cpSync(join(here, 'index.html'), join(st, 'index.html'));
cpSync(join(here, 'assets'), join(st, 'assets'), { recursive: true });
execSync(`cd "${tmp}" && zip -qr9 ../sarodi-landing-wp-plugin.zip sarodi-landing && cd sarodi-static && zip -qr9 ../../sarodi-landing-static.zip .`);
rmSync(tmp, { recursive: true, force: true });
console.log('build ok:', Math.round(bundle.length / 1024) + 'KB bundle');
