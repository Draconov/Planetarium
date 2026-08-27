import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src');
const mustExist = [
  'index.html', 'style.css', 'app.js', 'font_data.js',
  'assets/mus_loop.ogg', 'assets/sprites.json',
  'assets/sprites/s_UI_camera_00.png',
  'assets/sprites/s_UI_fastforward_00.png',
  'assets/sprites/s_UI_mute_00.png',
  'assets/sprites/s_UI_random_00.png',
  'assets/sprites/s_UI_reverse_00.png',
  'assets/sprites/s_UI_rocket_00.png',
  'assets/sprites/s_UI_slider_back_00.png',
  'assets/sprites/s_UI_slider_front_00.png',
  'assets/sprites/s_rocket_00.png'
];

for (let i = 0; i < 5; i++) mustExist.push(`assets/sprites/s_UI_temp_0${i}.png`);
for (let i = 0; i < 12; i++) mustExist.push(`assets/sprites/s_cloud_${String(i).padStart(2, '0')}.png`);
for (let i = 0; i < 17; i++) mustExist.push(`assets/sprites/s_moon_${String(i).padStart(2, '0')}.png`);

for (const file of mustExist) await access(resolve(source, file));

const html = await readFile(resolve(source, 'index.html'), 'utf8');
for (const ref of ['style.css', 'font_data.js', 'app.js']) {
  if (!html.includes(ref)) throw new Error(`index.html is missing ${ref}`);
}

console.log(`Asset check passed (${mustExist.length} required files).`);
