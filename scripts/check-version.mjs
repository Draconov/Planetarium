import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const conf = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
const cargo = await readFile('src-tauri/Cargo.toml', 'utf8');
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = new Map([
  ['package.json', pkg.version],
  ['src-tauri/tauri.conf.json', conf.version],
  ['src-tauri/Cargo.toml', cargoVersion]
]);
const expected = pkg.version;
for (const [file, version] of versions) {
  if (version !== expected) throw new Error(`Version mismatch: ${file} has ${version}, expected ${expected}`);
}
console.log(`Version check passed (${expected}).`);
