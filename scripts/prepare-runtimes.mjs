import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const runtime = path.join(root, 'public/runtime');
mkdirSync(path.join(runtime, 'python'), { recursive: true });
for (const file of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','pyodide-lock.json','python_stdlib.zip']) {
  cpSync(path.join(root, 'node_modules/pyodide', file), path.join(runtime, 'python', file));
}
cpSync(path.join(root, 'node_modules/monaco-editor/min/vs'), path.join(runtime, 'monaco/vs'), { recursive: true });
console.log('Local Python and Monaco assets prepared.');
