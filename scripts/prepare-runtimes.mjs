import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { capWasmMemory } from './wasm-memory.mjs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
const root = process.cwd();
const runtime = path.join(root, 'public/runtime');
mkdirSync(path.join(runtime, 'python'), { recursive: true });
for (const file of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','pyodide-lock.json','python_stdlib.zip']) {
  cpSync(path.join(root, 'node_modules/pyodide', file), path.join(runtime, 'python', file));
}
cpSync(path.join(root, 'node_modules/monaco-editor/min/vs'), path.join(runtime, 'monaco/vs'), { recursive: true });
const pythonWasm=path.join(runtime,'python/pyodide.asm.wasm');
writeFileSync(pythonWasm,capWasmMemory(readFileSync(pythonWasm),8192)); // 512 MiB including Python runtime
mkdirSync(path.join(runtime,'cpp/bin'),{recursive:true});
const cppRoot=path.join(root,'node_modules/@live-codes/clang-wasm');
cpSync(path.join(cppRoot,'assets/bin'),path.join(runtime,'cpp/bin'),{recursive:true});
cpSync(path.join(cppRoot,'assets/runtime-manifest.v1.json'),path.join(runtime,'cpp/runtime-manifest.v1.json'));
cpSync(path.join(cppRoot,'dist/clang-wasm-toolchain.global.js'),path.join(runtime,'cpp/clang-wasm-toolchain.global.js'));
cpSync(path.join(cppRoot,'THIRD-PARTY-NOTICES.md'),path.join(runtime,'cpp/THIRD-PARTY-NOTICES.md'));
cpSync(path.join(cppRoot,'LICENSE'),path.join(runtime,'cpp/LICENSE'));
const files=['python-worker.mjs','cpp-worker.mjs',...['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','pyodide-lock.json','python_stdlib.zip'].map(f=>'runtime/python/'+f),...['clang-wasm-toolchain.global.js','runtime-manifest.v1.json','bin/clang.wasm.gz','bin/lld.wasm.gz','bin/memfs.wasm.gz','bin/sysroot.tar.gz'].map(f=>'runtime/cpp/'+f)];
const receipt=bytes=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
writeFileSync(path.join(runtime,'integrity.json'),JSON.stringify(Object.fromEntries(files.map(f=>{const bytes=readFileSync(path.join(root,'public',f));return ['/'+f,{...receipt(bytes),...(f.endsWith('.gz')?{decoded:receipt(gunzipSync(bytes))}:{})}];}))));
console.log('Verified local Python, C++ and Monaco assets prepared.');
