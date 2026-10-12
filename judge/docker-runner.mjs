import {spawn,execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
export function sandboxArgs(name,image){
  if(!/^ccj-[a-f0-9-]{36}$/.test(name)||!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('Use an immutable local image ID.');
  return ['run','--rm','-i','--name',name,'--label','code-climb-judge=1','--pull=never','--runtime=runsc','--network=none','--ipc=none','--cap-drop=ALL','--security-opt=no-new-privileges','--read-only','--user=65534:65534','--memory=256m','--memory-swap=256m','--cpus=1','--pids-limit=32','--ulimit','nofile=64:64','--ulimit','fsize=16777216:16777216','--ulimit','core=0:0','--tmpfs','/tmp:rw,nosuid,nodev,exec,size=64m,mode=1777','--env','CLIMB_ISOLATED_JOB=1',image];
}
export function compareOutput(text,cases){
  try{const p=JSON.parse(text);return Array.isArray(p.outputs)&&p.outputs.length===cases.length&&p.outputs.every((v,i)=>isDeepStrictEqual(v,cases[i].expected));}catch{return false;}
}
export function createDockerRunner(image){
  sandboxArgs('ccj-'+randomUUID(),image);
  let healthy=false,active=0;
  async function remove(name){try{await exec('docker',['rm','-f',name],{timeout:10000,maxBuffer:8192,windowsHide:true});}catch(e){if(!String(e.stderr).includes('No such container')){healthy=false;throw e;}}}
  return {
    async initialize(){
      if(process.platform!=='linux')throw Error('Judge requires a dedicated Linux host.');
      const info=JSON.parse((await exec('docker',['info','--format','{{json .}}'],{timeout:10000,maxBuffer:100000})).stdout);
      if(!info.Runtimes?.runsc||!info.MemoryLimit||!info.PidsLimit||!info.CpuCfsQuota)throw Error('runsc and enforced memory/PID/CPU limits required.');
      await exec('docker',['image','inspect',image],{timeout:10000,maxBuffer:100000});
      // Reap ONLY our labelled job containers left by an interrupted controller.
      const ids=(await exec('docker',['ps','-aq','--filter','label=code-climb-judge=1'],{timeout:10000,maxBuffer:100000})).stdout.trim().split(/\s+/).filter(Boolean);
      for(const id of ids){if(!/^[a-f0-9]{12,64}$/.test(id))throw Error('Invalid container ID');await exec('docker',['rm','-f',id],{timeout:10000,maxBuffer:8192});}
      healthy=true;
    },
    ready(){return healthy;},
    async execute(job,tests){
      // Both players may submit at the same instant. Keep each job in its own
      // container and reject excess work instead of building an unbounded queue.
      if(!healthy||active>=2)throw Error('Runner unavailable or busy');active++;
      const name='ccj-'+randomUUID();
      try{
        const payload=JSON.stringify({source:job.source,language:job.language,fn:tests.fn,argumentType:tests.argumentType,cases:tests.cases.map(t=>t.args)});
        const output=await new Promise((resolve,reject)=>{
          const child=spawn('docker',sandboxArgs(name,image),{stdio:['pipe','pipe','pipe'],windowsHide:true});
          let text='',size=0,failed=false;
          const stop=()=>{if(failed)return;failed=true;void remove(name).catch(()=>{});child.kill('SIGKILL');reject(Error('Sandbox limit'));};
          const timer=setTimeout(stop,60000);
          child.stdout.on('data',data=>{size+=data.length;if(size>262144)stop();else text+=data.toString();});
          child.stderr.on('data',data=>{size+=data.length;if(size>262144)stop();});
          child.on('error',error=>{clearTimeout(timer);reject(error);});
          child.on('close',code=>{clearTimeout(timer);if(!failed)resolve({text,code});});
          child.stdin.on('error',()=>{});child.stdin.end(payload);
        });
        return output.code===0&&compareOutput(output.text,tests.cases)?'passed':'failed';
      }finally{try{await remove(name);}finally{active--;}}
    }
  };
}
