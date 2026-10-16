import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vinext emits a Node standalone copy as well as the Cloudflare Worker build.
// Sites packages dist/, so keeping this unused copy duplicates the WASM runtimes
// and exceeds the hosting archive limit. The separate Docker/Next build is untouched.
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const dist = join(root, 'dist');
const target = join(dist, 'standalone');
if (!existsSync(target)) process.exit(0);

const distStat = lstatSync(dist);
const targetStat = lstatSync(target);
if (!distStat.isDirectory() || distStat.isSymbolicLink() ||
    !targetStat.isDirectory() || targetStat.isSymbolicLink() ||
    dirname(realpathSync(target)) !== realpathSync(dist) ||
    !existsSync(join(dist, 'server', 'index.js')) ||
    !existsSync(join(target, 'server.js'))) {
  throw new Error('Refusing to prune an unexpected build directory.');
}

rmSync(target, { recursive: true });
console.log('Removed generated Vinext standalone duplicate from Sites build.');
