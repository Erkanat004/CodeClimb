export const defaultAds={provider:'off',publicKey:'',gameId:'',maxPerRound:3,adsTxt:''};
export function featureRepository(db){
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const getAds=()=>JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key='ads'").get()?.value??JSON.stringify(defaultAds));
  const hintCount=(user,lang,round)=>db.prepare('SELECT count(*) AS n FROM hint_unlocks WHERE user_id=? AND language=? AND round_key=?').get(user,lang,round).n;
  const unlocked=(user,lang,task)=>Boolean(db.prepare('SELECT 1 FROM hint_unlocks WHERE user_id=? AND language=? AND task_id=?').get(user,lang,task));
  const expire=now=>{
    db.prepare("UPDATE duel_submissions SET status='error',verdict='Проверка прервана. Отправь решение снова.',finished_at=? WHERE status='pending' AND received_at<?").run(now,now-120000);
    db.prepare("UPDATE duels SET status='cancelled',finished_at=? WHERE status='waiting' AND created_at<?").run(now,now-1800000);
  };
  const settle=(id,now)=>{
    const d=db.prepare('SELECT * FROM duels WHERE id=?').get(id);if(!d||d.status!=='active')return;
    if(db.prepare("SELECT 1 FROM duel_submissions WHERE duel_id=? AND status='pending'").get(id))return;
    const p=db.prepare('SELECT * FROM duel_players WHERE duel_id=? ORDER BY completed DESC,last_pass_at ASC').all(id);
    if(now<d.end_at&&!p.some(x=>x.completed===5))return;
    const winner=p[0].completed!==p[1].completed?p[0].user_id:p[0].completed>0&&p[0].last_pass_at!==p[1].last_pass_at?p[0].user_id:null;
    db.prepare("UPDATE duels SET status='finished',winner_id=?,finished_at=? WHERE id=?").run(winner,now,id);
  };
  const activeRoom=user=>db.prepare("SELECT d.id FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=? AND d.status IN ('waiting','active')").get(user);
  return {
    async changePassword(userId,oldHash,newHash,oldToken,newToken,now){
      return tx(()=>{
        const current=db.prepare('SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.user_id=? AND s.token_hash=? AND s.expires_at>? AND u.disabled=0 AND u.password_hash=?').get(userId,oldToken,now,oldHash);
        if(!current)return false;
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash,userId);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
        db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(newToken,userId,now+604800000);
        db.prepare('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES (?,?,?,?)').run(userId,userId,'change-password',now);
        return true;
      });
    },
    async getAdSettings(){return getAds();},
    async setAdSettings(settings,actor,now){tx(()=>{db.prepare("INSERT INTO app_settings VALUES ('ads',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(JSON.stringify(settings),now);db.prepare('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES (?,?,?,?)').run(actor,actor,'ads-settings',now);});},
    async adStats(){return {attempts:db.prepare('SELECT count(*) n FROM ad_attempts').get().n,granted:db.prepare('SELECT count(*) n FROM hint_unlocks').get().n};},
    async hintState(user,lang,task,round){return {unlocked:unlocked(user,lang,task),used:hintCount(user,lang,round)};},
    async createAdAttempt(p,now){
      return tx(()=>{
        const settings=getAds();
        if(unlocked(p.userId,p.language,p.taskId))return {error:'unlocked'};
        const used=hintCount(p.userId,p.language,p.roundKey);
        const reserved=db.prepare("SELECT count(*) n FROM ad_attempts WHERE user_id=? AND language=? AND round_key=? AND status='pending' AND expires_at>?").get(p.userId,p.language,p.roundKey,now).n;
        if(used+reserved>=settings.maxPerRound)return {error:'limit'};
        if(db.prepare("SELECT 1 FROM ad_attempts WHERE user_id=? AND language=? AND task_id=? AND status='pending' AND expires_at>?").get(p.userId,p.language,p.taskId,now))return {error:'pending'};
        db.prepare('INSERT INTO ad_attempts(id,user_id,language,task_id,round_key,provider,game_key,game_id,created_at,expires_at,round_limit) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(p.id,p.userId,p.language,p.taskId,p.roundKey,settings.provider,settings.publicKey,settings.gameId,now,now+600000,settings.maxPerRound);
        return {id:p.id,provider:settings.provider,expiresAt:now+600000,publicKey:settings.publicKey};
      });
    },
    async getAdAttempt(id){return db.prepare('SELECT * FROM ad_attempts WHERE id=?').get(id)??null;},
    async cancelAdAttempt(id,user){db.prepare("UPDATE ad_attempts SET status='cancelled' WHERE id=? AND user_id=? AND status='pending'").run(id,user);},
    async grantAdReward(id,tid,now){
      return tx(()=>{
        const known=db.prepare('SELECT attempt_id FROM ad_transactions WHERE tid=?').get(tid);
        if(known)return known.attempt_id===id;
        const p=db.prepare('SELECT * FROM ad_attempts WHERE id=?').get(id);
        if(!p||p.status!=='pending'||p.expires_at<=now)return false;
        if(hintCount(p.user_id,p.language,p.round_key)>=p.round_limit)return false;
        db.prepare('INSERT INTO ad_transactions VALUES (?,?,?)').run(tid,id,now);
        db.prepare('INSERT OR IGNORE INTO hint_unlocks VALUES (?,?,?,?,?)').run(p.user_id,p.language,p.task_id,p.round_key,now);
        db.prepare("UPDATE ad_attempts SET status='granted' WHERE id=?").run(id);return true;
      });
    },
    async listDuels(user,now){expire(now);const rows=db.prepare('SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=? ORDER BY d.created_at DESC LIMIT 10').all(user);for(const d of rows)settle(d.id,now);return db.prepare('SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=? ORDER BY d.created_at DESC LIMIT 10').all(user);},
    async createDuel({id,invite,language,userId},now){return tx(()=>{expire(now);if(activeRoom(userId))return false;db.prepare('INSERT INTO duels(id,invite,language,created_at) VALUES (?,?,?,?)').run(id,invite,language,now);db.prepare('INSERT INTO duel_players(duel_id,user_id) VALUES (?,?)').run(id,userId);return true;});},
    async joinDuel(invite,user,now){return tx(()=>{
      expire(now);const d=db.prepare("SELECT * FROM duels WHERE invite=? AND status='waiting'").get(invite);
      if(!d)return null;
      if(db.prepare('SELECT 1 FROM duel_players WHERE duel_id=? AND user_id=?').get(d.id,user))return d.id;
      if(activeRoom(user)||db.prepare('SELECT count(*) n FROM duel_players WHERE duel_id=?').get(d.id).n>=2)return null;
      db.prepare('INSERT INTO duel_players(duel_id,user_id) VALUES (?,?)').run(d.id,user);return d.id;
    });},
    async getDuel(id,user,now){
      expire(now);settle(id,now);
      const self=db.prepare('SELECT * FROM duel_players WHERE duel_id=? AND user_id=?').get(id,user);if(!self)return null;
      const room=db.prepare('SELECT * FROM duels WHERE id=?').get(id);
      const players=db.prepare('SELECT p.user_id,p.ready,p.completed,p.last_pass_at,u.username FROM duel_players p JOIN users u ON u.id=p.user_id WHERE duel_id=? ORDER BY u.username').all(id);
      const submission=db.prepare('SELECT id,level,status,verdict,received_at FROM duel_submissions WHERE duel_id=? AND user_id=? ORDER BY received_at DESC,id DESC LIMIT 1').get(id,user)??null;
      return {...room,players,self,submission,now};
    },
    async readyDuel(id,user,now){return tx(()=>{
      expire(now);const d=db.prepare("SELECT * FROM duels WHERE id=? AND status='waiting'").get(id);
      if(!d||!db.prepare('SELECT 1 FROM duel_players WHERE duel_id=? AND user_id=?').get(id,user))return false;
      db.prepare('UPDATE duel_players SET ready=1 WHERE duel_id=? AND user_id=?').run(id,user);
      if(db.prepare('SELECT count(*) n FROM duel_players WHERE duel_id=? AND ready=1').get(id).n===2)db.prepare("UPDATE duels SET status='active',start_at=?,end_at=? WHERE id=?").run(now+5000,now+1205000,id);
      return true;
    });},
    async leaveDuel(id,user,now){return tx(()=>{
      const d=db.prepare("SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE d.id=? AND p.user_id=? AND d.status IN ('waiting','active')").get(id,user);if(!d)return false;
      const other=db.prepare('SELECT user_id FROM duel_players WHERE duel_id=? AND user_id<>?').get(id,user);
      db.prepare("UPDATE duels SET status=?,winner_id=?,finished_at=? WHERE id=?").run(d.status==='active'?'finished':'cancelled',d.status==='active'?other?.user_id??null:null,now,id);
      return true;
    });},
    async beginSubmission(p,now){return tx(()=>{
      expire(now);settle(p.duelId,now);
      const d=db.prepare('SELECT * FROM duels WHERE id=?').get(p.duelId),self=db.prepare('SELECT * FROM duel_players WHERE duel_id=? AND user_id=?').get(p.duelId,p.userId);
      if(!d||!self||d.status!=='active'||now<d.start_at||now>=d.end_at||self.completed!==p.level||p.level>=5)return false;
      if(db.prepare("SELECT 1 FROM duel_submissions WHERE duel_id=? AND user_id=? AND status='pending'").get(p.duelId,p.userId))return false;
      db.prepare('INSERT INTO duel_submissions(id,duel_id,user_id,level,code_hash,received_at) VALUES (?,?,?,?,?,?)').run(p.id,p.duelId,p.userId,p.level,p.codeHash,now);return true;
    });},
    async finishSubmission(id,verdict,now){return tx(()=>{
      const s=db.prepare("SELECT * FROM duel_submissions WHERE id=? AND status='pending'").get(id);if(!s)return false;
      const d=db.prepare('SELECT * FROM duels WHERE id=?').get(s.duel_id);
      db.prepare('UPDATE duel_submissions SET status=?,verdict=?,finished_at=? WHERE id=?').run(verdict.status,verdict.message,now,id);
      if(d.status==='active'&&verdict.status==='passed'&&s.received_at<d.end_at)db.prepare('UPDATE duel_players SET completed=completed+1,last_pass_at=? WHERE duel_id=? AND user_id=? AND completed=?').run(s.received_at,s.duel_id,s.user_id,s.level);
      settle(d.id,now);return true;
    });},
  };
}
