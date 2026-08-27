import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const targetDir = resolve(root, 'src-tauri', 'target', 'release');
const releaseDir = resolve(root, 'release');
const output = resolve(releaseDir, `Planetarium-${pkg.version}.exe`);

const candidates = ['planetarium.exe', 'Planetarium.exe'];
let source = null;
for (const name of candidates) {
  const path = resolve(targetDir, name);
  try {
    if ((await stat(path)).isFile()) { source = path; break; }
  } catch {}
}
if (!source) {
  const files = await readdir(targetDir).catch(() => []);
  throw new Error(`Tauri executable not found in ${targetDir}. Found: ${files.join(', ') || '(nothing)'}`);
}

await mkdir(releaseDir, { recursive: true });
await copyFile(source, output);
console.log(`Windows executable: ${output}`);
