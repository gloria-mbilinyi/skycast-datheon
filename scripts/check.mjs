import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (/\.(js|mjs)$/.test(filename)) {
      const check = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (check.status) process.exit(check.status);
    }
  }
}
await scan(root);
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await readFile(path.resolve(root, match[1]));
console.log('JavaScript syntax and HTML asset references passed.');
