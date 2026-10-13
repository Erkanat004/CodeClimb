import {defaultAds} from './feature-repository.mjs';

const rows=async(db,sql,args=[]) => (await db.query(sql,args)).rows;
const one=async(db,sql,args=[]) => (await rows(db,sql,args))[0]??null;
const count=async(db,sql,args=[]) => Number((await one(db,sql,args)).n);

export function postgresFeatures({pool,first,tx}){
  const getAds=async db=>JSON.parse((await one(db,"SELECT value FROM app_settings WHERE key='ads'"))?.value??JSON.stringify(defaultAds));
  const hintCount=(db,user,language,round)=>count(db,'SELECT count(*) AS n FROM hint_unlocks WHERE user_id=$1 AND language=$2 AND round_key=$3',[user,language,round]);
  const unlocked=(db,user,language,task)=>one(db,'SELECT 1 FROM hint_unlocks WHERE user_id=$1 AND language=$2 AND task_id=$3',[user,language,task]);
  const expire=async(db,now)=>{
    await db.query("UPDATE duel_submissions SET status='error',verdict='Проверка прервана. Отправь решение снова.',finished_at=$1 WHERE status='pending' AND received_at<$2",[now,now-120000]);
    await db.query("UPDATE duels SET status='cancelled',finished_at=$1 WHERE status='waiting' AND created_at<$2",[now,now-1800000]);
  };
  const settle=async(db,id,now)=>{
    const duel=await one(db,'SELECT * FROM duels WHERE id=$1',[id]);if(!duel||duel.status!=='active')return;
    if(await one(db,"SELECT 1 FROM duel_submissions WHERE duel_id=$1 AND status='pending'",[id]))return;
    const players=await rows(db,'SELECT * FROM duel_players WHERE duel_id=$1 ORDER BY completed DESC,last_pass_at ASC',[id]);
    if(players.length!==2||now<duel.end_at&&!players.some(player=>player.completed===5))return;
    const winner=players[0].completed!==players[1].completed?players[0].user_id:players[0].completed>0&&players[0].last_pass_at!==players[1].last_pass_at?players[0].user_id:null;
    await db.query("UPDATE duels SET status='finished',winner_id=$1,finished_at=$2 WHERE id=$3 AND status='active'",[winner,now,id]);
  };
  const activeRoom=(db,user)=>one(db,"SELECT d.id FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=$1 AND d.status IN ('waiting','active')",[user]);
  return {
    async changePassword(userId,oldHash,newHash,oldToken,newToken,now){return tx(async db=>{
      const current=await one(db,'SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.token_hash=$2 AND s.expires_at>$3 AND u.disabled=0 AND u.password_hash=$4 FOR UPDATE',[userId,oldToken,now,oldHash]);
      if(!current)return false;
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[newHash,userId]);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[userId]);
      await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[newToken,userId,now+604800000]);
      await db.query('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES ($1,$1,$2,$3)',[userId,'change-password',now]);return true;
    });},
    async getAdSettings(){return getAds(pool);},
    async setAdSettings(settings,actor,now){await tx(async db=>{
      await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES ('ads',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at",[JSON.stringify(settings),now]);
      await db.query('INSERT INTO admin_audit(actor_id,target_id,action,created_at) VALUES ($1,$1,$2,$3)',[actor,'ads-settings',now]);
    });},
    async adStats(){return {attempts:await count(pool,'SELECT count(*) AS n FROM ad_attempts'),granted:await count(pool,'SELECT count(*) AS n FROM hint_unlocks')};},
    async hintState(user,language,task,round){return {unlocked:Boolean(await unlocked(pool,user,language,task)),used:await hintCount(pool,user,language,round)};},
    async createAdAttempt(p,now){return tx(async db=>{
      await one(db,'SELECT id FROM users WHERE id=$1 FOR UPDATE',[p.userId]);
      const settings=await getAds(db);
      if(await unlocked(db,p.userId,p.language,p.taskId))return {error:'unlocked'};
      const used=await hintCount(db,p.userId,p.language,p.roundKey);
      const reserved=await count(db,"SELECT count(*) AS n FROM ad_attempts WHERE user_id=$1 AND language=$2 AND round_key=$3 AND status='pending' AND expires_at>$4",[p.userId,p.language,p.roundKey,now]);
      if(used+reserved>=settings.maxPerRound)return {error:'limit'};
      if(await one(db,"SELECT 1 FROM ad_attempts WHERE user_id=$1 AND language=$2 AND task_id=$3 AND status='pending' AND expires_at>$4",[p.userId,p.language,p.taskId,now]))return {error:'pending'};
      await db.query('INSERT INTO ad_attempts(id,user_id,language,task_id,round_key,provider,game_key,game_id,created_at,expires_at,round_limit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[p.id,p.userId,p.language,p.taskId,p.roundKey,settings.provider,settings.publicKey,settings.gameId,now,now+600000,settings.maxPerRound]);
      return {id:p.id,provider:settings.provider,expiresAt:now+600000,publicKey:settings.publicKey};
    });},
    async getAdAttempt(id){return first('SELECT * FROM ad_attempts WHERE id=$1',[id]);},
    async cancelAdAttempt(id,user){await pool.query("UPDATE ad_attempts SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending'",[id,user]);},
    async grantAdReward(id,tid,now){return tx(async db=>{
      const known=await one(db,'SELECT attempt_id FROM ad_transactions WHERE tid=$1',[tid]);if(known)return known.attempt_id===id;
      const attempt=await one(db,'SELECT * FROM ad_attempts WHERE id=$1 FOR UPDATE',[id]);
      if(!attempt||attempt.status!=='pending'||attempt.expires_at<=now)return false;
      await one(db,'SELECT id FROM users WHERE id=$1 FOR UPDATE',[attempt.user_id]);
      if(await hintCount(db,attempt.user_id,attempt.language,attempt.round_key)>=attempt.round_limit)return false;
      const transaction=await one(db,'INSERT INTO ad_transactions(tid,attempt_id,created_at) VALUES ($1,$2,$3) ON CONFLICT(tid) DO NOTHING RETURNING tid',[tid,id,now]);
      if(!transaction)return (await one(db,'SELECT attempt_id FROM ad_transactions WHERE tid=$1',[tid]))?.attempt_id===id;
      await db.query('INSERT INTO hint_unlocks(user_id,language,task_id,round_key,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[attempt.user_id,attempt.language,attempt.task_id,attempt.round_key,now]);
      await db.query("UPDATE ad_attempts SET status='granted' WHERE id=$1",[id]);return true;
    });},
    async listDuels(user,now){return tx(async db=>{
      await expire(db,now);
      const rooms=await rows(db,'SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=$1 ORDER BY d.created_at DESC LIMIT 10',[user]);
      for(const room of rooms)await settle(db,room.id,now);
      return rows(db,'SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE p.user_id=$1 ORDER BY d.created_at DESC LIMIT 10',[user]);
    });},
    async createDuel({id,invite,language,userId},now){return tx(async db=>{
      await one(db,'SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);await expire(db,now);
      if(await activeRoom(db,userId))return false;
      await db.query('INSERT INTO duels(id,invite,language,created_at) VALUES ($1,$2,$3,$4)',[id,invite,language,now]);
      await db.query('INSERT INTO duel_players(duel_id,user_id) VALUES ($1,$2)',[id,userId]);return true;
    });},
    async joinDuel(invite,user,now){return tx(async db=>{
      await one(db,'SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);await expire(db,now);
      const duel=await one(db,"SELECT * FROM duels WHERE invite=$1 AND status='waiting' FOR UPDATE",[invite]);if(!duel)return null;
      if(await one(db,'SELECT 1 FROM duel_players WHERE duel_id=$1 AND user_id=$2',[duel.id,user]))return duel.id;
      if(await activeRoom(db,user)||await count(db,'SELECT count(*) AS n FROM duel_players WHERE duel_id=$1',[duel.id])>=2)return null;
      await db.query('INSERT INTO duel_players(duel_id,user_id) VALUES ($1,$2)',[duel.id,user]);return duel.id;
    });},
    async getDuel(id,user,now){return tx(async db=>{
      await expire(db,now);await settle(db,id,now);
      const self=await one(db,'SELECT * FROM duel_players WHERE duel_id=$1 AND user_id=$2',[id,user]);if(!self)return null;
      const room=await one(db,'SELECT * FROM duels WHERE id=$1',[id]);
      const players=await rows(db,'SELECT p.user_id,p.ready,p.completed,p.last_pass_at,u.username FROM duel_players p JOIN users u ON u.id=p.user_id WHERE duel_id=$1 ORDER BY u.username',[id]);
      const submission=await one(db,'SELECT id,level,status,verdict,received_at FROM duel_submissions WHERE duel_id=$1 AND user_id=$2 ORDER BY received_at DESC,id DESC LIMIT 1',[id,user]);
      return {...room,players,self,submission,now};
    });},
    async readyDuel(id,user,now){return tx(async db=>{
      await expire(db,now);const duel=await one(db,"SELECT * FROM duels WHERE id=$1 AND status='waiting' FOR UPDATE",[id]);
      if(!duel||!await one(db,'SELECT 1 FROM duel_players WHERE duel_id=$1 AND user_id=$2',[id,user]))return false;
      await db.query('UPDATE duel_players SET ready=1 WHERE duel_id=$1 AND user_id=$2',[id,user]);
      if(await count(db,'SELECT count(*) AS n FROM duel_players WHERE duel_id=$1 AND ready=1',[id])===2)await db.query("UPDATE duels SET status='active',start_at=$1,end_at=$2 WHERE id=$3",[now+5000,now+1205000,id]);return true;
    });},
    async leaveDuel(id,user,now){return tx(async db=>{
      const duel=await one(db,"SELECT d.* FROM duels d JOIN duel_players p ON p.duel_id=d.id WHERE d.id=$1 AND p.user_id=$2 AND d.status IN ('waiting','active') FOR UPDATE",[id,user]);if(!duel)return false;
      const other=await one(db,'SELECT user_id FROM duel_players WHERE duel_id=$1 AND user_id<>$2',[id,user]);
      await db.query('UPDATE duels SET status=$1,winner_id=$2,finished_at=$3 WHERE id=$4',[duel.status==='active'?'finished':'cancelled',duel.status==='active'?other?.user_id??null:null,now,id]);return true;
    });},
    async beginSubmission(p,now){return tx(async db=>{
      await expire(db,now);await settle(db,p.duelId,now);
      const duel=await one(db,'SELECT * FROM duels WHERE id=$1 FOR UPDATE',[p.duelId]);
      const self=await one(db,'SELECT * FROM duel_players WHERE duel_id=$1 AND user_id=$2 FOR UPDATE',[p.duelId,p.userId]);
      if(!duel||!self||duel.status!=='active'||now<duel.start_at||now>=duel.end_at||self.completed!==p.level||p.level>=5)return false;
      if(await one(db,"SELECT 1 FROM duel_submissions WHERE duel_id=$1 AND user_id=$2 AND status='pending'",[p.duelId,p.userId]))return false;
      await db.query('INSERT INTO duel_submissions(id,duel_id,user_id,level,code_hash,received_at) VALUES ($1,$2,$3,$4,$5,$6)',[p.id,p.duelId,p.userId,p.level,p.codeHash,now]);return true;
    });},
    async finishSubmission(id,verdict,now){return tx(async db=>{
      const submission=await one(db,"SELECT * FROM duel_submissions WHERE id=$1 AND status='pending' FOR UPDATE",[id]);if(!submission)return false;
      const duel=await one(db,'SELECT * FROM duels WHERE id=$1 FOR UPDATE',[submission.duel_id]);
      await db.query('UPDATE duel_submissions SET status=$1,verdict=$2,finished_at=$3 WHERE id=$4',[verdict.status,verdict.message,now,id]);
      if(duel.status==='active'&&verdict.status==='passed'&&submission.received_at<duel.end_at)await db.query('UPDATE duel_players SET completed=completed+1,last_pass_at=$1 WHERE duel_id=$2 AND user_id=$3 AND completed=$4',[submission.received_at,submission.duel_id,submission.user_id,submission.level]);
      await settle(db,duel.id,now);return true;
    });},
  };
}
