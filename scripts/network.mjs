import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [mode,...args]=process.argv.slice(2);
if(!['build','start'].includes(mode))throw Error('Use build or start.');
const cli=fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url));
const child=spawn(process.execPath,[cli,mode,...(mode==='build'?['--webpack']:['--hostname','127.0.0.1','--port','3000']),...args],{
  stdio:'inherit',windowsHide:true,env:{...process.env,CODE_CLIMB_NETWORK:'1'},
});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
