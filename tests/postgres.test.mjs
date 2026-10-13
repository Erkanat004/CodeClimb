import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresRepository,validatePostgresUrl} from '../server/postgres-repository.mjs';
import {createSqliteRepository} from '../server/sqlite-repository.mjs';
import {codeHash,hashPassword} from '../server/auth.mjs';
import {createDatabaseAdmin} from '../server/database-admin.mjs';
import {readDatabaseConfig,writeDatabaseConfig} from '../server/database-config.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

async function fixture(t){
  const db=new PGlite();await db.waitReady;
  const query=(...args)=>db.query(...args);
  const pool={query,exec:sql=>db.exec(sql),connect:async()=>({query,exec:sql=>db.exec(sql),release(){}})};
  const repo=await createPostgresRepository({pool});
  t.after(async()=>db.close());
  return repo;
}

test('PostgreSQL URL validation rejects TLS downgrades and ambiguous options',()=>{
  const remote='postgresql://user:password@db.example.com:5432/codeclimb';
  assert.throws(()=>validatePostgresUrl(remote,{publicMode:true}),/verify-full/);
  assert.throws(()=>validatePostgresUrl(remote+'?sslmode=disable'),/TLS/);
  assert.throws(()=>validatePostgresUrl(remote+'?sslmode=verify-full&sslmode=disable'),/Ambiguous/);
  assert.throws(()=>validatePostgresUrl(remote+'?sslmode=verify-full&ssl=false'),/Ambiguous/);
  assert.doesNotThrow(()=>validatePostgresUrl(remote+'?sslmode=verify-full',{publicMode:true}));
});

test('PostgreSQL schema supports verified accounts, sessions, progress and admin actions',async t=>{
  const repo=await fixture(t),now=Date.now(),secret='s'.repeat(32),passwordHash=await hashPassword('a strong test password');
  await repo.bootstrapAdmin('admin996',passwordHash);
  assert.equal((await repo.findUser('admin996')).role,'admin');
  const pending={id:'a'.repeat(64),username:'climber',email:'climber@example.com',passwordHash,codeHash:codeHash(secret,'a'.repeat(64),'123456')};
  assert.equal(await repo.createPending(pending,now),true);
  assert.deepEqual(await repo.verifyRegistration(pending.id,codeHash(secret,pending.id,'000000'),now),{error:'invalid'});
  const verified=await repo.verifyRegistration(pending.id,pending.codeHash,now);
  assert.equal(verified.user.username,'climber');
  assert.equal((await repo.findEmail(pending.email)).id,verified.user.id);
  assert.equal(await repo.createSession('token',verified.user.id,now+100000,passwordHash),true);
  assert.equal((await repo.getSession('token',now)).username,'climber');
  const progress={completed:2,drafts:{0:'code'},avatar:1,seconds:30};
  assert.equal(await repo.saveProgress(verified.user.id,'python',progress,0,'easy'),1);
  assert.equal(await repo.saveProgress(verified.user.id,'python',progress,0,'easy'),null);
  assert.deepEqual((await repo.getProgress(verified.user.id,'python','easy')).data,progress);
  assert.equal((await repo.adminProgress(verified.user.id))[0].completed,2);
  assert.equal(await repo.rateLimit('key',2,60000,now),true);
  assert.equal(await repo.rateLimit('key',2,60000,now),true);
  assert.equal(await repo.rateLimit('key',2,60000,now),false);
  assert.equal(await repo.adminAction((await repo.findUser('admin996')).id,verified.user.id,'block',now),true);
  assert.equal(await repo.getSession('token',now),null);
});

test('PostgreSQL enforces reward quota and advances duels only after a verdict',async t=>{
  const repo=await fixture(t),now=Date.now();
  await repo.createUser({id:'u1',username:'alpha',passwordHash:'x'});
  await repo.createUser({id:'u2',username:'beta',passwordHash:'x'});
  await repo.setAdSettings({provider:'test',publicKey:'',gameId:'',maxPerRound:1,adsTxt:''},'u1',now);
  const ad={id:'ad1',userId:'u1',language:'python',taskId:1,roundKey:'classic:1'};
  assert.equal((await repo.createAdAttempt(ad,now)).id,'ad1');
  assert.equal((await repo.createAdAttempt({...ad,id:'ad2',taskId:2},now)).error,'limit');
  assert.equal(await repo.grantAdReward('ad1','transaction-1',now),true);
  assert.equal(await repo.grantAdReward('ad1','transaction-1',now),true);
  assert.equal((await repo.hintState('u1','python',1,'classic:1')).unlocked,true);
  assert.equal((await repo.createAdAttempt({...ad,id:'ad3',taskId:2},now)).error,'limit');
  await repo.setAdSettings({provider:'test',publicKey:'',gameId:'',maxPerRound:2,adsTxt:''},'u1',now);
  assert.equal((await repo.createAdAttempt({...ad,id:'ad4',taskId:2},now)).id,'ad4');
  assert.equal(await repo.grantAdReward('ad4','transaction-1',now),false);
  assert.equal((await repo.hintState('u1','python',2,'classic:1')).unlocked,false);
  assert.equal(await repo.createDuel({id:'room',invite:'abcdef0123456789',language:'python',userId:'u1'},now),true);
  assert.equal(await repo.joinDuel('abcdef0123456789','u2',now),'room');
  assert.equal(await repo.readyDuel('room','u1',now),true);
  assert.equal(await repo.readyDuel('room','u2',now),true);
  assert.equal(await repo.beginSubmission({id:'submission',duelId:'room',userId:'u1',level:0,codeHash:'hash'},now+5001),true);
  assert.equal((await repo.getDuel('room','u1',now+5001)).self.completed,0);
  assert.equal(await repo.finishSubmission('submission',{status:'passed',message:'ok'},now+5002),true);
  assert.equal((await repo.getDuel('room','u1',now+5003)).self.completed,1);
});

test('SQLite snapshot imports into empty PostgreSQL without losing player progress',async t=>{
  const source=createSqliteRepository(':memory:');t.after(()=>source.close());
  const target=await fixture(t);
  await source.createUser({id:'player',username:'player',passwordHash:'hash'});
  await source.saveProgress('player','cpp',{completed:3,drafts:{},avatar:0,seconds:75},0,'full');
  const counts=await target.importSnapshot(await source.exportSnapshot());
  assert.equal(counts.users,1);assert.equal(counts.full_progress,1);
  assert.equal((await target.getProgress('player','cpp','full')).data.completed,3);
  await assert.rejects(target.importSnapshot(await source.exportSnapshot()),/not empty/);
});

test('admin migration keeps credentials encrypted and finishes with restart required',async t=>{
  const source=createSqliteRepository(':memory:');t.after(()=>source.close());
  await source.createUser({id:'player',username:'player',passwordHash:'hash'});
  const target=await fixture(t),directory=await mkdtemp(path.join(tmpdir(),'climb-pg-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=path.join(directory,'database-config.json'),secret='z'.repeat(40),url='postgresql://player:private-pass@localhost:5432/codeclimb';
  let frozen=false;
  const admin=createDatabaseAdmin({repository:source,configSecret:secret,freeze:()=>{frozen=true;return {waitForDrain:async()=>{},unfreeze:()=>{frozen=false;}};},
    targetRepository:async()=>target,saveConfiguration:(value,key)=>writeDatabaseConfig(value,key,file)});
  assert.equal(admin.status().driver,'sqlite');
  assert.equal(admin.start(url).id.length,36);
  for(let attempt=0;attempt<100&&admin.status().job.state==='running';attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(admin.status().job.state,'completed');
  assert.equal(admin.status().job.restartRequired,true);
  assert.equal(frozen,true);
  assert.equal((await target.findUser('player')).username,'player');
  assert.equal((await readDatabaseConfig(secret,file)).url,url);
  assert(!String(await readFile(file,'utf8')).includes('private-pass'));
  await assert.rejects(readDatabaseConfig('wrong'.repeat(8),file),/cannot be decrypted/);
});

test('admin migration never resumes SQLite writes after imported data cannot be activated',async t=>{
  const source=createSqliteRepository(':memory:');t.after(()=>source.close());
  await source.createUser({id:'player',username:'player',passwordHash:'hash'});
  const target=await fixture(t);
  let frozen=false;
  const admin=createDatabaseAdmin({repository:source,configSecret:'q'.repeat(40),freeze:()=>{frozen=true;return {waitForDrain:async()=>{},unfreeze:()=>{frozen=false;}};},
    targetRepository:async()=>target,saveConfiguration:async()=>{throw Error('disk unavailable');}});
  admin.start('postgresql://player:private-pass@localhost:5432/codeclimb');
  for(let attempt=0;attempt<100&&admin.status().job.state==='running';attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(admin.status().job.state,'failed');
  assert.equal(admin.status().job.restartRequired,true);
  assert.equal(frozen,true);
  assert.equal((await target.findUser('player')).username,'player');
  assert(!admin.status().job.error.includes('private-pass'));
});
