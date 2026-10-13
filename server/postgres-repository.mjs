import pg from 'pg';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {hashToken,sameHash} from './auth.mjs';
import {postgresFeatures} from './postgres-features.mjs';

pg.types.setTypeParser(pg.types.builtins.INT8,value=>Number(value));
const migrations=fileURLToPath(new URL('./pg-migrations/',import.meta.url));
const conflict=error=>error?.code==='23505';
const rows=async(db,sql,args=[]) => (await db.query(sql,args)).rows;
const one=async(db,sql,args=[]) => (await rows(db,sql,args))[0]??null;
const transaction=async(pool,fn)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
};

export function validatePostgresUrl(value,{publicMode=false}={}){
  if(typeof value!=='string'||value.length>2048)throw Error('Invalid PostgreSQL URL.');
  let url;try{url=new URL(value);}catch{throw Error('Invalid PostgreSQL URL.');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.pathname.slice(1)||url.hash)throw Error('Invalid PostgreSQL URL.');
  const modes=url.searchParams.getAll('sslmode');
  if(modes.length>1||url.searchParams.has('ssl'))throw Error('Ambiguous PostgreSQL TLS options.');
  const sslmode=(modes[0]??'').toLowerCase();
  if(publicMode&&!['localhost','127.0.0.1','::1','postgres'].includes(url.hostname)&&sslmode!=='verify-full')throw Error('Remote PostgreSQL must use sslmode=verify-full.');
  if(['disable','allow','prefer'].includes(sslmode))throw Error('PostgreSQL TLS must not be disabled.');
  return url;
}

export function postgresPool(connectionString,options={}){
  validatePostgresUrl(connectionString,options);
  const pool=new pg.Pool({connectionString,max:8,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'code-climb'});
  pool.on('error',error=>console.error('PostgreSQL idle connection error:',error.code??error.name));
  return pool;
}

export async function testPostgresConnection(connectionString,options={}){
  const pool=postgresPool(connectionString,options);
  try{const value=await one(pool,'SELECT current_database() AS name, version() AS version');return {database:String(value.name),version:String(value.version).split(' ').slice(0,2).join(' ')};}
  finally{await pool.end();}
}

async function migrate(pool,{testPool=false}={}){
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,applied_at BIGINT NOT NULL)');
  for(const name of readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort()){
    await transaction(pool,async db=>{
      if(!testPool)await db.query('SELECT pg_advisory_xact_lock(1908848)');
      if(await one(db,'SELECT 1 FROM schema_migrations WHERE name=$1',[name]))return;
      const sql=readFileSync(path.join(migrations,name),'utf8');
      if(testPool&&typeof db.exec==='function')await db.exec(sql);
      else await db.query(sql);
      await db.query('INSERT INTO schema_migrations(name,applied_at) VALUES ($1,$2)',[name,Date.now()]);
    });
  }
}

export async function createPostgresRepository({connectionString=process.env.DATABASE_URL,pool,publicMode=false}={}){
  const owned=!pool;
  if(owned)pool=postgresPool(connectionString,{publicMode});
  try{await migrate(pool,{testPool:!owned});}catch(error){if(owned)await pool.end();throw error;}
  const q=(sql,args)=>rows(pool,sql,args),first=(sql,args)=>one(pool,sql,args),tx=fn=>transaction(pool,fn);
  const repo={
    driver:'postgres',
    ...postgresFeatures({pool,q,first,tx}),
    async findUser(username){return first('SELECT * FROM users WHERE username=$1',[username]);},
    async findEmail(email){return first('SELECT id FROM users WHERE email=$1',[email]);},
    async bootstrapAdmin(username,passwordHash){
      const key='bootstrap:'+username,fingerprint=hashToken(passwordHash);
      await tx(async db=>{
        const applied=(await one(db,'SELECT value FROM app_settings WHERE key=$1',[key]))?.value;
        const existing=await one(db,'SELECT id,role,password_hash FROM users WHERE username=$1 FOR UPDATE',[username]);
        if(existing){
          if(existing.role!=='admin')throw Error('Admin username already belongs to a player. Refusing to promote it.');
          if(applied&&applied!==fingerprint&&existing.password_hash!==passwordHash){
            await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,existing.id]);
            await db.query('DELETE FROM sessions WHERE user_id=$1',[existing.id]);
            await db.query('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES ($1,$1,$2,$3)',[existing.id,'rotate-password',Date.now()]);
          }
        }else await db.query("INSERT INTO users(id,username,password_hash,created_at,role) VALUES ($1,$2,$3,$4,'admin')",[randomUUID(),username,passwordHash,Date.now()]);
        await db.query('INSERT INTO app_settings(key,value,updated_at) VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at',[key,fingerprint,Date.now()]);
      });
    },
    async createPending(p,now){
      await pool.query('DELETE FROM pending_registrations WHERE expires_at<=$1',[now]);
      try{await pool.query('INSERT INTO pending_registrations(id,username,email,password_hash,code_hash,sent_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',[p.id,p.username,p.email,p.passwordHash,p.codeHash,now,now+600000]);return true;}
      catch(error){if(conflict(error))return false;throw error;}
    },
    async getPending(id){return first('SELECT * FROM pending_registrations WHERE id=$1',[id]);},
    async deletePending(id){await pool.query('DELETE FROM pending_registrations WHERE id=$1',[id]);},
    async rotateCode(id,previousHash,nextHash,now){return (await pool.query('UPDATE pending_registrations SET code_hash=$1,attempts=0,sent_at=$2,expires_at=$3 WHERE id=$4 AND code_hash=$5 AND expires_at>$2',[nextHash,now,now+600000,id,previousHash])).rowCount>0;},
    async verifyRegistration(id,digest,now){
      try{return await tx(async db=>{
        const p=await one(db,'SELECT * FROM pending_registrations WHERE id=$1 FOR UPDATE',[id]);
        if(!p||p.expires_at<=now||p.attempts>=5)return {error:'invalid'};
        if(!sameHash(p.code_hash,digest)){await db.query('UPDATE pending_registrations SET attempts=attempts+1 WHERE id=$1',[id]);return {error:'invalid'};}
        const user={id:randomUUID(),username:p.username,email:p.email,role:'player',email_verified_at:now};
        await db.query('INSERT INTO users(id,username,email,password_hash,email_verified_at,created_at) VALUES ($1,$2,$3,$4,$5,$5)',[user.id,user.username,user.email,p.password_hash,now]);
        await db.query('DELETE FROM pending_registrations WHERE id=$1',[id]);return {user};
      });}catch(error){if(conflict(error))return {error:'conflict'};throw error;}
    },
    async createUser(user){try{await pool.query('INSERT INTO users(id,username,password_hash,created_at) VALUES ($1,$2,$3,$4)',[user.id,user.username,user.passwordHash,Date.now()]);return true;}catch(error){if(conflict(error))return false;throw error;}},
    async createSession(tokenHash,userId,expires,verifiedHash=null){return (await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) SELECT $1,id,$2 FROM users WHERE id=$3 AND disabled=0 AND ($4::text IS NULL OR password_hash=$4)',[tokenHash,expires,userId,verifiedHash])).rowCount===1;},
    async getSession(tokenHash,now){return first('SELECT u.id,u.username,u.email,u.email_verified_at,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.disabled=0',[tokenHash,now]);},
    async deleteSession(tokenHash){await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash]);},
    async cleanup(now){await pool.query('DELETE FROM sessions WHERE expires_at<=$1',[now]);await pool.query('DELETE FROM rate_limits WHERE expires_at<=$1',[now]);await pool.query('DELETE FROM pending_registrations WHERE expires_at<=$1',[now]);},
    async adminOverview(now){const r=await first("SELECT (SELECT count(*) FROM users WHERE role='player') AS users,(SELECT count(*) FROM users WHERE role='player' AND email_verified_at IS NOT NULL) AS verified,(SELECT count(*) FROM users WHERE disabled=1) AS blocked,(SELECT count(DISTINCT user_id) FROM sessions WHERE expires_at>$1) AS sessions",[now]);return r;},
    async adminUsers(search='',offset=0){const pattern='%'+search.replaceAll('!','!!').replaceAll('%','!%').replaceAll('_','!_')+'%';const users=await q("SELECT id,username,email,email_verified_at,role,disabled,created_at FROM users WHERE username ILIKE $1 ESCAPE '!' OR email ILIKE $1 ESCAPE '!' ORDER BY created_at DESC,id LIMIT 50 OFFSET $2",[pattern,offset]);const total=(await first("SELECT count(*) AS n FROM users WHERE username ILIKE $1 ESCAPE '!' OR email ILIKE $1 ESCAPE '!'",[pattern])).n;return {users,total};},
    async adminProgress(userId){return q("SELECT language,'classic' AS difficulty,(data::json ->> 'completed')::integer AS completed,updated_at FROM progress WHERE user_id=$1 UNION ALL SELECT language,difficulty,(data::json ->> 'completed')::integer,updated_at FROM course_progress WHERE user_id=$1 UNION ALL SELECT language,'full',(data::json ->> 'completed')::integer,updated_at FROM full_progress WHERE user_id=$1",[userId]);},
    async adminAction(actorId,targetId,action,now){return tx(async db=>{const target=await one(db,'SELECT role FROM users WHERE id=$1 FOR UPDATE',[targetId]);if(!target||target.role==='admin')return false;if(action==='block'||action==='unblock')await db.query('UPDATE users SET disabled=$1 WHERE id=$2',[action==='block'?1:0,targetId]);if(action!=='unblock')await db.query('DELETE FROM sessions WHERE user_id=$1',[targetId]);await db.query('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES ($1,$2,$3,$4)',[actorId,targetId,action,now]);return true;});},
    async rateLimit(key,limit,windowMs,now){const row=await first('INSERT INTO rate_limits(key,count,expires_at) VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=$3 THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<=$3 THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count',[key,now+windowMs,now]);return row.count<=limit;},
    async getProgress(userId,language,difficulty='classic'){const table=difficulty==='full'?'full_progress':difficulty==='classic'?'progress':'course_progress';const args=table==='course_progress'?[userId,language,difficulty]:[userId,language];const row=await first(`SELECT data,revision FROM ${table} WHERE user_id=$1 AND language=$2${table==='course_progress'?' AND difficulty=$3':''}`,args);return row?{data:JSON.parse(row.data),revision:row.revision}:null;},
    async saveProgress(userId,language,data,revision,difficulty='classic'){
      const table=difficulty==='full'?'full_progress':difficulty==='classic'?'progress':'course_progress';
      try{return await tx(async db=>{
        const key=table==='course_progress'?[userId,language,difficulty]:[userId,language];
        const row=await one(db,`SELECT revision FROM ${table} WHERE user_id=$1 AND language=$2${table==='course_progress'?' AND difficulty=$3':''} FOR UPDATE`,key);
        if((row?.revision??0)!==revision)return null;
        const next=revision+1,now=Date.now();
        if(row)await db.query(`UPDATE ${table} SET data=$1,revision=$2,updated_at=$3 WHERE user_id=$4 AND language=$5${table==='course_progress'?' AND difficulty=$6':''}`,[JSON.stringify(data),next,now,...key]);
        else if(table==='course_progress')await db.query('INSERT INTO course_progress(user_id,language,difficulty,data,revision,updated_at) VALUES ($1,$2,$3,$4,$5,$6)',[...key,JSON.stringify(data),next,now]);
        else await db.query(`INSERT INTO ${table}(user_id,language,data,revision,updated_at) VALUES ($1,$2,$3,$4,$5)`,[...key,JSON.stringify(data),next,now]);
        return next;
      });}catch(error){if(conflict(error))return null;throw error;}
    },
    async importSnapshot(snapshot){
      const columns={
        users:['id','username','password_hash','created_at','email','email_verified_at','role','disabled'],
        progress:['user_id','language','data','revision','updated_at'],
        course_progress:['user_id','language','difficulty','data','revision','updated_at'],
        full_progress:['user_id','language','data','revision','updated_at'],
        app_settings:['key','value','updated_at'],
        admin_audit:['actor_id','target_id','action','created_at'],
        hint_unlocks:['user_id','language','task_id','round_key','created_at'],
        ad_attempts:['id','user_id','language','task_id','round_key','provider','game_key','game_id','status','created_at','expires_at','round_limit'],
        ad_transactions:['tid','attempt_id','created_at'],
        duels:['id','invite','language','status','created_at','start_at','end_at','winner_id','finished_at'],
        duel_players:['duel_id','user_id','ready','completed','last_pass_at'],
        duel_submissions:['id','duel_id','user_id','level','code_hash','status','received_at','finished_at','verdict'],
      };
      return tx(async db=>{
        for(const table of Object.keys(columns))if(await one(db,`SELECT 1 FROM ${table} LIMIT 1`))throw Error('Target PostgreSQL database is not empty.');
        const counts={};
        for(const [table,fields] of Object.entries(columns)){
          const source=snapshot[table];if(!Array.isArray(source))throw Error(`Missing migration table: ${table}`);
          const sql=`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((_,index)=>'$'+(index+1)).join(',')})`;
          for(const row of source)await db.query(sql,fields.map(field=>row[field]??null));
          const actual=Number((await one(db,`SELECT count(*) AS n FROM ${table}`)).n);
          if(actual!==source.length)throw Error(`Migration count mismatch: ${table}`);
          counts[table]=actual;
        }
        return counts;
      });
    },
    async close(){if(owned)await pool.end();},
  };
  return repo;
}
