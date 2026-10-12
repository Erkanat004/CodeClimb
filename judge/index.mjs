import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createDockerRunner} from './docker-runner.mjs';
import {buildCases} from './cases.mjs';
import {duelVersion} from '../server/duel-tasks.mjs';
const token=process.env.JUDGE_TOKEN??'',secret=process.env.JUDGE_CASE_SECRET??'';
if(token.length<32||secret.length<32)throw Error('Configure independent JUDGE_TOKEN and JUDGE_CASE_SECRET.');
const runner=createDockerRunner(process.env.JUDGE_IMAGE??'');
await runner.initialize();
const hash=s=>createHash('sha256').update(s).digest();
const jobs=new Map();
const server=createServer(async(req,res)=>{
  const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
    if(!timingSafeEqual(hash(String(req.headers.authorization??'')),hash('Bearer '+token)))return send(403,{error:'Forbidden'});
    if(req.method==='GET'&&req.url==='/health')return send(200,{ready:runner.ready()});
    if(req.method!=='POST'||req.url!=='/check')return send(404,{error:'Not found'});
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>131072)return send(413,{error:'Too large'});chunks.push(chunk);}
    const job=JSON.parse(Buffer.concat(chunks).toString());
    if(!/^[a-f0-9-]{36}$/.test(job.id)||job.version!==duelVersion||!['python','cpp'].includes(job.language)||!Number.isInteger(job.level)||job.level<0||job.level>4||typeof job.source!=='string'||job.source.length>30000)return send(400,{error:'Invalid job'});
    const digest=hash(JSON.stringify(job)).toString('hex');
    if(jobs.has(job.id)){const previous=jobs.get(job.id);if(previous.digest!==digest)return send(409,{error:'ID conflict'});return send(200,{id:job.id,status:await previous.result});}
    const result=runner.execute(job,buildCases(job.language,job.level,secret)).catch(()=> 'error');
    jobs.set(job.id,{digest,result,created:Date.now()});
    return send(200,{id:job.id,status:await result});
  }catch{return send(400,{error:'Invalid request'});}
});
server.requestTimeout=15000;server.headersTimeout=10000;server.maxConnections=16;
setInterval(()=>{for(const [id,job] of jobs)if(Date.now()-job.created>600000)jobs.delete(id);},60000).unref();
server.listen(Number(process.env.JUDGE_PORT??3100),'127.0.0.1',()=>console.log('Isolated judge ready on loopback. Put authenticated HTTPS in front for remote access.'));
