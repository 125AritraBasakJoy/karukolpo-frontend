import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist', 'karukolpo-frontend', 'browser');
const indexPath = join(browserDir, 'index.html');

let index = readFileSync(indexPath, 'utf8');

const jsFiles = readdirSync(browserDir).filter(f => /^chunk-[A-Za-z0-9]+\.js$/.test(f));

const existing = new Set([...index.matchAll(/href="([^"]+\.js)"/g)].map(m => m[1]));

const links = [];
for (const file of jsFiles) {
  if (existing.has(file)) continue;
  links.push(`  <link rel="modulepreload" href="${file}">`);
}

if (links.length === 0) {
  console.log('inject-preloads: no new chunks to preload');
  process.exit(0);
}

const block = `\n<!-- Preload all route chunks in parallel (injected post-build) -->\n${links.join('\n')}\n`;
index = index.replace('</head>', block + '</head>');

writeFileSync(indexPath, index);
console.log(`inject-preloads: added ${links.length} modulepreload links`);
