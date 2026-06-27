import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const copyDir = (source, target) => {
  if (!fs.existsSync(source)) return 0;
  fs.mkdirSync(target, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return count;
};

const assets = [
  ['music', 'music']
];

let copied = 0;
for (const [from, to] of assets) {
  copied += copyDir(path.join(root, from), path.join(distDir, to));
}

console.log(`Copied ${copied} runtime asset files into dist`);
