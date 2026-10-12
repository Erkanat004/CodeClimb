import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {request as httpRequest} from 'node:http';
import {createSqliteRepository} from '../server/sqlite-repository.mjs';
import {createAccountServer} from '../server/app.mjs';
import {createMailer} from '../server/mail.mjs';
import {hashPassword,verifyPassword} from '../server/auth.mjs';

const password='Testing passphrase 2026';
const passwordHash=await hashPassword(password);
const shortAdminPassword='TestAdmin1';
const adminHash=await hashPassword(shortAdminPassword);
async function fixture(t,options={}){
  const repo=createSqliteRepository(':memory:'),messages=[];
  let now=Date.now(),deliveryFails=false;
  const mailer={mode:'file',async sendCode(m){if(deliveryFails)throw Error('Simulated provider failure');messages.push(m);}};
  const server=await createAccountServer({repository:repo,mailer,nowFn:()=>now,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(r=>server.close(r));await repo.close();});
  const url='http://127.0.0.1:'+server.address().port+'/api/account';
  async function request(route,{method='GET',data,cookie,origin='http://localhost:5173',headers={}}={}){
    return new Promise((resolve,reject)=>{
      const req=httpRequest(url+route,{method,headers:{Origin:origin,'Content-Type':'application/json','X-Code-Climb':'1',...(cookie?{Cookie:cookie}:{}),...headers}},response=>{
        let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);
        response.on('end',()=>{try{const setCookie=response.headers['set-cookie']?.[0];resolve({status:response.statusCode,body:JSON.parse(text),setCookie,cookie:setCookie?.split(';')[0]});}catch(e){reject(e);}});
      });req.on('error',reject);req.end(data!==undefined?JSON.stringify(data):undefined);
    });
  }
  async function register(username='climber_test'){
    const result=await request('/register',{method:'POST',data:{username,password,email:username+'@example.com'}});
    assert.equal(result.status,202,JSON.stringify(result.body));
    return {challengeId:result.body.challengeId,code:messages.at(-1).code};
  }
  const verify=p=>request('/verify-email',{method:'POST',data:p});
  async function player(username='climber_test'){return verify(await register(username));}
  async function admin(){await repo.bootstrapAdmin('admin996',adminHash);return request('/login',{method:'POST',data:{username:'Admin996',password:shortAdminPassword}});}
  return {repo,messages,request,register,verify,player,admin,advance(ms){now+=ms;},failMail(v=true){deliveryFails=v;}};
}

test('password change requires the current password and revokes older sessions',async t=>{
  const f=await fixture(t);await f.player();
  const a=await f.request('/login',{method:'POST',data:{username:'climber_test',password}});
  const b=await f.request('/login',{method:'POST',data:{username:'climber_test',password}});
  assert.equal((await f.request('/password',{method:'POST',cookie:a.cookie,data:{currentPassword:'wrong',newPassword:'New Testing passphrase 2026'}})).status,400);
  const changed=await f.request('/password',{method:'POST',cookie:a.cookie,data:{currentPassword:password,newPassword:'New Testing passphrase 2026'}});
  assert.equal(changed.status,200);assert.match(changed.setCookie,/HttpOnly/);
  assert.equal((await f.request('/me',{cookie:a.cookie})).body.user,null);
  assert.equal((await f.request('/me',{cookie:b.cookie})).body.user,null);
  assert.equal((await f.request('/me',{cookie:changed.cookie})).body.user.username,'climber_test');
  assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password}})).status,401);
  assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password:'New Testing passphrase 2026'}})).status,200);
});

test('rewarded hints are server-granted, quota-limited and admin configured',async t=>{
  const adSecret='s'.repeat(32),f=await fixture(t,{adSecret});
  const player=await f.player(),admin=await f.admin();
  assert.equal((await f.request('/hints/python/1',{cookie:player.cookie})).body.provider,'off');
  assert.equal((await f.request('/hints/python/1',{method:'POST',cookie:player.cookie,data:{}})).status,503);
  const key='public_key_123',game='game_123';
  assert.equal((await f.request('/admin/ads',{method:'PUT',cookie:admin.cookie,data:{provider:'applixir',publicKey:key,gameId:game,maxPerRound:3,adsTxt:'example.com, pub-000, DIRECT'}})).status,200);
  const attempt=await f.request('/hints/python/1',{method:'POST',cookie:player.cookie,data:{}});
  assert.equal(attempt.status,201);assert.equal(attempt.body.provider,'applixir');
  const confirm=async(id,tid)=>{
    const signature=createHash('md5').update(key+game+id+tid+adSecret).digest('hex');
    return f.request('/rewards/applixir?userId='+id+'&tid='+encodeURIComponent(tid)+'&gameApiKey='+key+'&gameId='+game+'&signature='+signature);
  };
  assert.equal((await confirm(attempt.body.id,'provider-tid-1')).status,200);
  const opened=await f.request('/hints/python/1',{cookie:player.cookie});
  assert.equal(opened.body.unlocked,true);assert.equal(typeof opened.body.text,'string');
  assert.equal(opened.body.remaining,2);
  for(const task of [2,3]){
    const next=await f.request('/hints/python/'+task,{method:'POST',cookie:player.cookie,data:{}});
    assert.equal(next.status,201);
    assert.equal((await confirm(next.body.id,'provider-tid-'+task)).status,200);
  }
  assert.equal((await f.request('/hints/python/4',{method:'POST',cookie:player.cookie,data:{}})).status,409);
  assert.equal((await f.request('/hints/cpp/116',{cookie:player.cookie})).body.remaining,3);
});

test('duels require the judge, hide opponent code and advance only on server verdicts',async t=>{
  const verdicts=[];
  const judge={enabled:true,status:async()=>true,check:async job=>{verdicts.push(job);return {status:'passed',message:'ok'};}};
  const f=await fixture(t,{judge}),a=await f.player('alpha_player'),b=await f.player('beta_player');
  const created=await f.request('/duels',{method:'POST',cookie:a.cookie,data:{language:'python'}});
  assert.equal(created.status,201);
  const firstRoom=await f.request('/duels/'+created.body.id,{cookie:a.cookie});
  assert.equal(firstRoom.body.task,null);
  const joined=await f.request('/duels/join',{method:'POST',cookie:b.cookie,data:{invite:firstRoom.body.invite}});
  assert.equal(joined.status,200);
  assert.equal((await f.request('/duels/'+created.body.id+'/ready',{method:'POST',cookie:a.cookie,data:{}})).status,200);
  assert.equal((await f.request('/duels/'+created.body.id+'/ready',{method:'POST',cookie:b.cookie,data:{}})).status,200);
  f.advance(5001);
  const room=await f.request('/duels/'+created.body.id,{cookie:a.cookie});
  assert.equal(room.body.task.fn,'count_even');
  assert.equal(room.body.level,0);
  assert(!JSON.stringify(room.body).includes('source'));
  assert.equal((await f.request('/duels/'+created.body.id+'/submit',{method:'POST',cookie:a.cookie,data:{level:1,source:'def count_even(numbers):\n    return 0'}})).status,400);
  const submitted=await f.request('/duels/'+created.body.id+'/submit',{method:'POST',cookie:a.cookie,data:{level:0,source:'def count_even(numbers):\n    return 0'}});
  assert.equal(submitted.status,202);
  await new Promise(resolve=>setTimeout(resolve,30));
  const after=await f.request('/duels/'+created.body.id,{cookie:a.cookie});
  assert.equal(after.body.level,1);
  assert.equal(verdicts[0].language,'python');
  assert.equal(verdicts[0].level,0);
});

test('registration verifies email before creating an account; codes are single-use and secret',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/me')).body.registration.delivery,'local-test');
  const challenge=await f.register();
  assert.equal(await f.repo.findUser('climber_test'),null);
  const pending=await f.repo.getPending(challenge.challengeId);
  assert.notEqual(pending.code_hash,challenge.code);assert.notEqual(pending.password_hash,password);
  const result=await f.verify(challenge);assert.equal(result.status,200);
  assert.match(result.setCookie,/HttpOnly; SameSite=Strict/);assert.doesNotMatch(result.setCookie,/Secure/);
  assert.equal(result.body.user.email,'climber_test@example.com');assert.equal(result.body.user.role,'player');
  assert(result.body.user.email_verified_at);assert(!JSON.stringify(result.body).includes('password_hash'));
  const stored=await f.repo.findUser('climber_test');assert(await verifyPassword(password,stored.password_hash));
  assert.notEqual(stored.password_hash,passwordHash);
  assert.equal((await f.verify(challenge)).status,400);
  assert.equal((await f.request('/me',{cookie:result.cookie})).body.user.id,stored.id);
});

test('OTP wrong-attempt limit, cooldown, rotation, expiry and delivery rollback',async t=>{
  const f=await fixture(t),c=await f.register();
  const wrong=c.code==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)assert.equal((await f.verify({...c,code:wrong})).status,400);
  assert.equal((await f.verify(c)).status,400);
  assert.equal((await f.request('/resend-code',{method:'POST',data:c})).status,429);
  f.advance(60001);f.failMail();
  assert.equal((await f.request('/resend-code',{method:'POST',data:c})).status,503);
  f.failMail(false);f.advance(60001);
  assert.equal((await f.request('/resend-code',{method:'POST',data:c})).status,200);
  assert.equal((await f.repo.getPending(c.challengeId)).attempts,0);
  const latest=f.messages.at(-1);
  // A new six-digit code may randomly equal the previous code; either is valid only once.
  if(latest.code!==c.code)assert.equal((await f.verify(c)).status,400);
  assert.equal((await f.verify({...c,code:latest.code})).status,200);
  const expired=await f.register('expired_player');f.advance(600001);
  assert.equal((await f.verify(expired)).status,400);
  f.failMail();
  assert.equal((await f.request('/register',{method:'POST',data:{username:'mail_failed',email:'failure@example.com',password}})).status,503);
  assert.equal(await f.repo.findUser('mail_failed'),null);
  f.failMail(false);await f.register('mail_failed');
});

test('concurrent verification creates one account and one session',async t=>{
  const f=await fixture(t),c=await f.register();
  const results=await Promise.all([f.verify(c),f.verify(c)]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);
  assert.equal((await f.repo.adminOverview(Date.now())).users,1);
});

test('validation, CSRF, host, reserved admin username and unconfigured mail fail closed',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/register',{method:'POST',data:null})).status,400);
  assert.equal((await f.request('/login',{method:'POST',data:[]})).status,400);
  const data={username:'player123',email:'player@example.com',password};
  assert.equal((await f.request('/register',{method:'POST',data,origin:'https://foreign.invalid'})).status,403);
  assert.equal((await f.request('/register',{method:'POST',data,headers:{'X-Code-Climb':''}})).status,403);
  assert.equal((await f.request('/me',{headers:{Host:'attacker.invalid'}})).status,403);
  assert.equal((await f.request('/me',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  for(const invalid of [{email:'invalid'},{password:'short'},{username:'a'},{username:'Admin996'}]){
    const r=await f.request('/register',{method:'POST',data:{...data,...invalid}});
    assert.equal(r.status,invalid.username==='Admin996'?409:400);
  }
  const disabled=await fixture(t,{mailer:createMailer()});
  assert.equal((await disabled.request('/register',{method:'POST',data})).status,503);
});

test('full 15-level progress is isolated from old routes, languages and other accounts',async t=>{
  const f=await fixture(t),p=await f.player(),cookie=p.cookie;
  const data={completed:15,avatar:2,seconds:88,drafts:{14:'def solution():\n    pass'}};
  const save=await f.request('/progress/python/full',{method:'PUT',cookie,data:{data,revision:0}});
  assert.equal(save.status,200);assert.equal(save.body.revision,1);
  assert.equal((await f.request('/progress/python/full',{method:'PUT',cookie,data:{data,revision:0}})).status,409);
  for(const invalid of [{completed:16},{drafts:{15:'bad'}},{avatar:4},{seconds:-1}]){
    assert.equal((await f.request('/progress/python/full',{method:'PUT',cookie,data:{data:{...data,...invalid},revision:1}})).status,400);
  }
  assert.equal((await f.request('/progress/python/full',{cookie})).body.data.completed,15);
  for(const route of ['/progress/python','/progress/python/classic','/progress/python/easy','/progress/cpp/full']){
    assert.equal((await f.request(route,{cookie})).body.data.completed,0);
  }
  assert.equal((await f.request('/progress/python/easy',{method:'PUT',cookie,data:{data,revision:0}})).status,400);
  const other=await f.player('second_player');
  assert.equal((await f.request('/progress/python/full',{cookie:other.cookie})).body.data.completed,0);
  await f.request('/logout',{method:'POST',cookie});
  assert.equal((await f.request('/progress/python/full',{cookie})).status,401);
});

test('admin access is server-only; blocking and revocation invalidate player sessions',async t=>{
  const f=await fixture(t),player=await f.player(),admin=await f.admin();
  assert.equal(admin.status,200);assert.equal(admin.body.user.role,'admin');
  assert.equal((await f.request('/admin/users')).status,401);
  assert.equal((await f.request('/admin/users',{cookie:player.cookie})).status,403);
  const list=await f.request('/admin/users',{cookie:admin.cookie});assert.equal(list.status,200);
  assert.equal(list.body.total,2);assert(!JSON.stringify(list.body).includes('password_hash'));
  assert(!JSON.stringify(list.body).includes('code_hash'));
  assert.equal((await f.request('/admin/users?q='+encodeURIComponent("' OR 1=1 --"),{cookie:admin.cookie})).body.total,0);
  const route='/admin/users/'+player.body.user.id;
  const action=kind=>f.request(route+'/'+kind,{method:'POST',cookie:admin.cookie,data:{}});
  assert.equal((await action('block')).status,200);
  assert.equal((await f.request('/me',{cookie:player.cookie})).body.user,null);
  assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password}})).status,401);
  assert.equal((await action('unblock')).status,200);
  const login=await f.request('/login',{method:'POST',data:{username:'climber_test',password}});
  assert.equal(login.status,200);assert.equal((await action('revoke-sessions')).status,200);
  assert.equal((await f.request('/me',{cookie:login.cookie})).body.user,null);
  assert.equal((await f.request('/admin/users/'+admin.body.user.id+'/block',{method:'POST',cookie:admin.cookie,data:{}})).status,409);
  await f.repo.createUser({id:randomUUID(),username:'occupied_admin',passwordHash});
  await assert.rejects(f.repo.bootstrapAdmin('occupied_admin',adminHash),/Refusing/);
  await f.repo.bootstrapAdmin('admin996',passwordHash);
  assert(await verifyPassword(password,(await f.repo.findUser('admin996')).password_hash));
  assert.equal((await f.request('/me',{cookie:admin.cookie})).body.user,null);
});

test('login rate limit persists independently of successful password checks',async t=>{
  const f=await fixture(t);await f.player();
  for(let i=0;i<10;i++)assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password:'incorrect'}})).status,401);
  assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password}})).status,429);
  f.advance(900001);
  assert.equal((await f.request('/login',{method:'POST',data:{username:'climber_test',password}})).status,200);
});

test('public configuration requires trusted proxy, HTTPS, stable secrets and email; cookies are Secure',async t=>{
  const repo=createSqliteRepository(':memory:');t.after(()=>repo.close());
  const settings={repository:repo,publicMode:true,origin:'https://climb.example',proxyToken:'p'.repeat(64),otpSecret:'o'.repeat(64),mailer:{mode:'resend',sendCode:async()=>{}}};
  for(const change of [{origin:'http://climb.example'},{proxyToken:''},{otpSecret:undefined},{mailer:createMailer()}]){
    await assert.rejects(createAccountServer({...settings,...change}),/Public mode/);
  }
  assert.throws(()=>createMailer({production:true,mode:'file'}),/Production requires/);
  const publicSettings={...settings};
  delete publicSettings.repository;
  const f=await fixture(t,publicSettings);
  await f.repo.bootstrapAdmin('admin996',adminHash);
  const headers={Host:'climb.example','X-Code-Climb-Proxy':settings.proxyToken,'X-Code-Climb-Client-IP':'192.0.2.1'};
  assert.equal((await f.request('/me',{headers:{Host:'climb.example'}})).status,403);
  const login=await f.request('/login',{method:'POST',headers,origin:settings.origin,data:{username:'Admin996',password:shortAdminPassword}});
  assert.equal(login.status,200);assert.match(login.setCookie,/; Secure/);
  assert.equal((await f.request('/me',{headers,cookie:login.cookie})).body.user.role,'admin');
});

test('SQLite reopen preserves classic and full progress without recreating admin credentials',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'code-climb-test-')),filename=path.join(temp,'test.sqlite');
  let repo=createSqliteRepository(filename);
  try{
    const id=randomUUID();await repo.createUser({id,username:'legacy_player',passwordHash});
    const progress={completed:3,avatar:0,seconds:40,drafts:{}};
    assert.equal(await repo.saveProgress(id,'python',progress,0),1);
    assert.equal(await repo.saveProgress(id,'cpp',{...progress,completed:15},0,'full'),1);
    await repo.close();repo=createSqliteRepository(filename);
    assert.equal((await repo.findUser('legacy_player')).email,null);
    assert.equal((await repo.getProgress(id,'python')).data.completed,3);
    assert.equal((await repo.getProgress(id,'cpp','full')).data.completed,15);
    assert.equal(await repo.getProgress(id,'python','full'),null);
  }finally{await repo.close();await rm(temp,{recursive:true,force:true});}
});

test('mail provider adapter uses configured sender and reports failures without exposing secrets',async()=>{
  let sent;
  const options={mode:'resend',apiKey:'test-only-secret',from:'Climb <mail@example.com>',production:true};
  const mailer=createMailer({...options,fetcher:async(url,request)=>{sent={url,request};return {ok:true};}});
  await mailer.sendCode({id:'test',email:'player@example.com',code:'123456'});
  assert.equal(sent.url,'https://api.resend.com/emails');
  assert.deepEqual(JSON.parse(sent.request.body).to,['player@example.com']);
  assert.equal(JSON.parse(sent.request.body).from,options.from);
  await assert.rejects(createMailer({...options,fetcher:async()=>({ok:false})}).sendCode({id:'test',email:'player@example.com',code:'123456'}),/Не удалось отправить/);
});
