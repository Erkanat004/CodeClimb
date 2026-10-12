import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { sameHash,hashToken } from './auth.mjs';
import {featureRepository} from './feature-repository.mjs';

export function createSqliteRepository(filename) {
  if(filename!==':memory:')mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const dir=fileURLToPath(new URL('./migrations/',import.meta.url));
  for(const file of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()){
    if(db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(file))continue;
    db.exec('BEGIN IMMEDIATE');
    try{db.exec(readFileSync(path.join(dir,file),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(file,Date.now());db.exec('COMMIT');}
    catch(e){db.exec('ROLLBACK');db.close();throw e;}
  }
  db.exec('PRAGMA optimize');
  return {
    ...featureRepository(db),
    async findUser(username){return db.prepare('SELECT * FROM users WHERE username=?').get(username)??null;},
    async findEmail(email){return db.prepare('SELECT id FROM users WHERE email=?').get(email)??null;},
    async bootstrapAdmin(username,passwordHash){
      const key='bootstrap:'+username,fingerprint=hashToken(passwordHash);
      const applied=db.prepare('SELECT value FROM app_settings WHERE key=?').get(key)?.value;
      const existing=db.prepare('SELECT id,role,password_hash FROM users WHERE username=?').get(username);
      if(existing){
        if(existing.role!=='admin')throw Error('Admin username already belongs to a player. Refusing to promote it.');
        if(applied&&applied!==fingerprint&&existing.password_hash!==passwordHash){
          db.exec('BEGIN IMMEDIATE');
          try{
            db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash,existing.id);
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
            db.prepare('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES (?,?,?,?)').run(existing.id,existing.id,'rotate-password',Date.now());
            db.prepare('UPDATE app_settings SET value=?,updated_at=? WHERE key=?').run(fingerprint,Date.now(),key);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
        }
        db.prepare('INSERT INTO app_settings VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key,fingerprint,Date.now());
        return;
      }
      db.prepare("INSERT INTO users(id,username,password_hash,created_at,role) VALUES (?,?,?,?,'admin')").run(randomUUID(),username,passwordHash,Date.now());
      db.prepare('INSERT INTO app_settings VALUES (?,?,?)').run(key,fingerprint,Date.now());
    },
    async createPending(p,now){
      db.prepare('DELETE FROM pending_registrations WHERE expires_at<=?').run(now);
      try{db.prepare('INSERT INTO pending_registrations(id,username,email,password_hash,code_hash,sent_at,expires_at) VALUES (?,?,?,?,?,?,?)').run(p.id,p.username,p.email,p.passwordHash,p.codeHash,now,now+600000);return true;}
      catch(e){if(String(e).includes('UNIQUE'))return false;throw e;}
    },
    async getPending(id){return db.prepare('SELECT * FROM pending_registrations WHERE id=?').get(id)??null;},
    async deletePending(id){db.prepare('DELETE FROM pending_registrations WHERE id=?').run(id);},
    async rotateCode(id,previousHash,nextHash,now){
      return db.prepare('UPDATE pending_registrations SET code_hash=?,attempts=0,sent_at=?,expires_at=? WHERE id=? AND code_hash=? AND expires_at>?').run(nextHash,now,now+600000,id,previousHash,now).changes>0;
    },
    async verifyRegistration(id,digest,now){
      db.exec('BEGIN IMMEDIATE');
      try{
        const p=db.prepare('SELECT * FROM pending_registrations WHERE id=?').get(id);
        if(!p||p.expires_at<=now||p.attempts>=5){db.exec('COMMIT');return {error:'invalid'};}
        if(!sameHash(p.code_hash,digest)){db.prepare('UPDATE pending_registrations SET attempts=attempts+1 WHERE id=?').run(id);db.exec('COMMIT');return {error:'invalid'};}
        const user={id:randomUUID(),username:p.username,email:p.email,role:'player',email_verified_at:now};
        db.prepare('INSERT INTO users(id,username,email,password_hash,email_verified_at,created_at) VALUES (?,?,?,?,?,?)').run(user.id,user.username,user.email,p.password_hash,now,now);
        db.prepare('DELETE FROM pending_registrations WHERE id=?').run(id);
        db.exec('COMMIT');return {user};
      }catch(e){db.exec('ROLLBACK');if(String(e).includes('UNIQUE'))return {error:'conflict'};throw e;}
    },
    async createUser(user){try{db.prepare('INSERT INTO users(id,username,password_hash,created_at) VALUES (?,?,?,?)').run(user.id,user.username,user.passwordHash,Date.now());return true;}catch(e){if(String(e).includes('UNIQUE'))return false;throw e;}},
    async createSession(tokenHash,userId,expires,verifiedHash=null){return db.prepare('INSERT INTO sessions SELECT ?,id,? FROM users WHERE id=? AND disabled=0 AND (? IS NULL OR password_hash=?)').run(tokenHash,expires,userId,verifiedHash,verifiedHash).changes===1;},
    async getSession(tokenHash,now){return db.prepare('SELECT u.id,u.username,u.email,u.email_verified_at,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(tokenHash,now)??null;},
    async deleteSession(tokenHash){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);},
    async cleanup(now){db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(now);db.prepare('DELETE FROM pending_registrations WHERE expires_at<=?').run(now);},
    async adminOverview(now){
      return {
        users:db.prepare("SELECT count(*) AS n FROM users WHERE role='player'").get().n,
        verified:db.prepare("SELECT count(*) AS n FROM users WHERE role='player' AND email_verified_at IS NOT NULL").get().n,
        blocked:db.prepare('SELECT count(*) AS n FROM users WHERE disabled=1').get().n,
        sessions:db.prepare('SELECT count(DISTINCT user_id) AS n FROM sessions WHERE expires_at>?').get(now).n,
      };
    },
    async adminUsers(search='',offset=0){
      const pattern='%'+search.replaceAll('!','!!').replaceAll('%','!%').replaceAll('_','!_')+'%';
      const users=db.prepare("SELECT id,username,email,email_verified_at,role,disabled,created_at FROM users WHERE username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' ORDER BY created_at DESC,id LIMIT 50 OFFSET ?").all(pattern,pattern,offset);
      const total=db.prepare("SELECT count(*) AS n FROM users WHERE username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!'").get(pattern,pattern).n;
      return {users,total};
    },
    async adminProgress(userId){
      return db.prepare("SELECT language,'classic' AS difficulty,json_extract(data,'$.completed') AS completed,updated_at FROM progress WHERE user_id=? UNION ALL SELECT language,difficulty,json_extract(data,'$.completed'),updated_at FROM course_progress WHERE user_id=? UNION ALL SELECT language,'full',json_extract(data,'$.completed'),updated_at FROM full_progress WHERE user_id=?").all(userId,userId,userId);
    },
    async adminAction(actorId,targetId,action,now){
      db.exec('BEGIN IMMEDIATE');
      try{
        const target=db.prepare('SELECT role FROM users WHERE id=?').get(targetId);
        if(!target){db.exec('ROLLBACK');return false;}
        if(target.role==='admin'){db.exec('ROLLBACK');return false;}
        if(action==='block'||action==='unblock')db.prepare('UPDATE users SET disabled=? WHERE id=?').run(action==='block'?1:0,targetId);
        if(action!=='unblock')db.prepare('DELETE FROM sessions WHERE user_id=?').run(targetId);
        db.prepare('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES (?,?,?,?)').run(actorId,targetId,action,now);
        db.exec('COMMIT');return true;
      }catch(e){db.exec('ROLLBACK');throw e;}
    },
    async rateLimit(key,limit,windowMs,now){
      db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END').run(key,now+windowMs,now,now);
      return db.prepare('SELECT count FROM rate_limits WHERE key=?').get(key).count<=limit;
    },
    async getProgress(userId,language,difficulty='classic'){
      if(difficulty==='full'){const row=db.prepare('SELECT data,revision FROM full_progress WHERE user_id=? AND language=?').get(userId,language);return row?{data:JSON.parse(row.data),revision:row.revision}:null;}
      const row=difficulty==='classic'?db.prepare('SELECT data,revision FROM progress WHERE user_id=? AND language=?').get(userId,language):db.prepare('SELECT data,revision FROM course_progress WHERE user_id=? AND language=? AND difficulty=?').get(userId,language,difficulty);
      return row?{data:JSON.parse(row.data),revision:row.revision}:null;
    },
    async saveProgress(userId,language,data,revision,difficulty='classic'){
      db.exec('BEGIN IMMEDIATE');
      try{
        if(difficulty==='full'){
          const row=db.prepare('SELECT revision FROM full_progress WHERE user_id=? AND language=?').get(userId,language);
          if((row?.revision??0)!==revision){db.exec('ROLLBACK');return null;}
          const next=revision+1;
          db.prepare('INSERT INTO full_progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,language) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at').run(userId,language,JSON.stringify(data),next,Date.now());
          db.exec('COMMIT');return next;
        }
        const row=difficulty==='classic'?db.prepare('SELECT revision FROM progress WHERE user_id=? AND language=?').get(userId,language):db.prepare('SELECT revision FROM course_progress WHERE user_id=? AND language=? AND difficulty=?').get(userId,language,difficulty);
        if((row?.revision??0)!==revision){db.exec('ROLLBACK');return null;}
        const next=revision+1;
        if(difficulty==='classic')db.prepare('INSERT INTO progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,language) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at').run(userId,language,JSON.stringify(data),next,Date.now());
        else db.prepare('INSERT INTO course_progress VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,language,difficulty) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at').run(userId,language,difficulty,JSON.stringify(data),next,Date.now());
        db.exec('COMMIT');return next;
      }catch(e){db.exec('ROLLBACK');throw e;}
    },
    async close(){db.close();},
  };
}
