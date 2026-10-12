import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
if(Number(process.versions.node.split('.')[0])<24)throw Error('Use Node.js 24 LTS or newer (built-in SQLite).');
await import('./prepare-runtimes.mjs');
const children=[];let exiting=false;
function stop(code=0){if(exiting)return;exiting=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),500).unref();}
for(const args of [['server/index.mjs'],['scripts/run-framework.mjs','dev','--host','localhost','--port','5173']]){
  const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...process.env,APP_ORIGIN:'http://localhost:5173',ACCOUNT_PORT:'3001',CODE_CLIMB_LOCAL:'1'}});children.push(child);
  child.on('error',e=>{console.error(e.message);stop(1);});child.on('exit',code=>{if(!exiting)stop(code||1);});
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
