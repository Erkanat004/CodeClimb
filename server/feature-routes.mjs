import {createHash,randomUUID} from 'node:crypto';
import {newToken,hashToken,sameHash} from './auth.mjs';
import {hintFor} from './detailed-hints.mjs';
import {duelTask,duelVersion} from './duel-tasks.mjs';
export async function featureRoutes(c){
  const {route,parsed,req,send,body,user,now,repository:r,judge,adSecret,publicMode,limit,fail,clock}=c;
  // This is the only external callback. Host/trusted proxy checks still apply;
  // GET does not use browser CSRF headers, but must carry the provider signature.
  if(route==='/api/account/rewards/applixir'&&req.method==='GET'){
    const q=parsed.searchParams;
    for(const key of ['userId','tid','signature','gameApiKey','gameId'])if(q.getAll(key).length!==1)fail(403,'Недопустимое подтверждение.');
    const id=q.get('userId'),tid=q.get('tid'),signature=q.get('signature');
    if(adSecret.length<32||!/^[a-f0-9]{64}$/.test(id)||!/^[-a-zA-Z0-9_:.]{1,160}$/.test(tid)||!/^[a-f0-9]{32}$/.test(signature))fail(403,'Недопустимое подтверждение.');
    const attempt=await r.getAdAttempt(id);
    if(!attempt||attempt.provider!=='applixir'||q.get('gameApiKey')!==attempt.game_key||q.get('gameId')!==attempt.game_id)fail(403,'Недопустимое подтверждение.');
    const digest=createHash('md5').update(attempt.game_key+attempt.game_id+id+tid+adSecret).digest('hex');
    if(!sameHash(digest,signature))fail(403,'Недопустимое подтверждение.');
    if(!await r.grantAdReward(id,tid,now))fail(409,'Подтверждение истекло или отменено.');
    send(200,{ok:true});return true;
  }
  if(route==='/api/account/admin/ads'){
    if(!user)fail(401,'Войди в аккаунт.');if(user.role!=='admin')fail(403,'Доступ только для администратора.');
    if(req.method==='GET'){send(200,{settings:await r.getAdSettings(),stats:await r.adStats(),webhookReady:adSecret.length>=32,testAllowed:!publicMode});return true;}
    if(req.method==='PUT'){
      await limit('ads-settings:'+user.id,20);
      const p=await body(req,16384);
      if(!['off','test','applixir'].includes(p.provider)||typeof p.publicKey!=='string'||!/^[a-zA-Z0-9_-]{0,160}$/.test(p.publicKey)||typeof p.gameId!=='string'||!/^[a-zA-Z0-9_-]{0,100}$/.test(p.gameId)||!Number.isInteger(p.maxPerRound)||p.maxPerRound<1||p.maxPerRound>3||typeof p.adsTxt!=='string'||p.adsTxt.length>10000||/[<>\x00]/.test(p.adsTxt))fail(400,'Проверь настройки. Максимум — 3 подсказки за раунд.');
      if(p.provider==='test'&&publicMode)fail(400,'Тестовый режим запрещён в публичном запуске.');
      if(p.provider==='applixir'&&(!p.publicKey||!p.gameId||adSecret.length<32||!p.adsTxt.trim()))fail(400,'Нужны API key сайта, Game ID, ads.txt и серверный APPLIXIR_WEBHOOK_SECRET.');
      await r.setAdSettings({provider:p.provider,publicKey:p.publicKey,gameId:p.gameId,maxPerRound:p.maxPerRound,adsTxt:p.adsTxt.trim()},user.id,now);
      send(200,{ok:true});return true;
    }
  }
  if(route==='/api/account/ads.txt'&&req.method==='GET'){send(200,(await r.getAdSettings()).adsTxt+'\n','text/plain; charset=utf-8');return true;}
  const hint=route.match(/^\/api\/account\/hints\/(python|cpp)\/(\d+)$/);
  if(hint){
    if(!user)fail(401,'Для подробных подсказок войди в аккаунт.');
    const language=hint[1],taskId=Number(hint[2]),details=hintFor(language,taskId);
    if(!details)fail(404,'Задача не найдена.');
    const state=await r.hintState(user.id,language,taskId,details.roundKey),settings=await r.getAdSettings();
    const allowed=settings.provider==='applixir'&&adSecret.length>=32||settings.provider==='test'&&!publicMode&&user.role==='admin';
    if(req.method==='GET'){send(200,{...state,text:state.unlocked?details.text:null,remaining:Math.max(0,settings.maxPerRound-state.used),limit:settings.maxPerRound,provider:allowed?settings.provider:'off'});return true;}
    if(req.method==='POST'){
      await body(req,2048);await limit('reward:'+user.id,15);
      if(!allowed)fail(503,'Реклама пока не подключена. Короткая подсказка остаётся бесплатной.');
      const attempt=await r.createAdAttempt({id:newToken(),userId:user.id,language,taskId,roundKey:details.roundKey},now);
      if(attempt.error)fail(409,attempt.error==='limit'?'Лимит подсказок исчерпан или зарезервирован открытым просмотром.':'Подсказка уже открыта или просмотр уже начат.');
      send(201,attempt);return true;
    }
  }
  const reward=route.match(/^\/api\/account\/rewards\/([a-f0-9]{64})(?:\/(cancel|test))?$/);
  if(reward){
    if(!user)fail(401,'Войди в аккаунт.');const p=await r.getAdAttempt(reward[1]);
    if(!p||p.user_id!==user.id)fail(404,'Просмотр не найден.');
    if(req.method==='POST'&&reward[2]){
      await body(req,2048);
      if(reward[2]==='test'){
        if(publicMode||user.role!=='admin'||p.provider!=='test')fail(403,'Тест доступен только локальному администратору.');
        if(!await r.grantAdReward(p.id,'test:'+p.id,now))fail(409,'Тестовый просмотр истёк.');
      }else await r.cancelAdAttempt(p.id,user.id);
      send(200,{ok:true});return true;
    }
    if(req.method==='GET'&&!reward[2]){send(200,{status:p.status==='pending'&&p.expires_at<=now?'expired':p.status});return true;}
  }
  if(route==='/api/account/duels'&&req.method==='GET'){
    if(!user)fail(401,'Для дуэли войди в аккаунт.');
    send(200,{ready:await judge.status(),rooms:await r.listDuels(user.id,now)});return true;
  }
  if(route==='/api/account/duels'&&req.method==='POST'){
    if(!user)fail(401,'Войди в аккаунт.');await limit('duel-create:'+user.id,10);
    if(!await judge.status())fail(503,'Изолированный проверяющий сервер ещё не подключён.');
    const p=await body(req,2048);
    if(!['python','cpp'].includes(p.language))fail(400,'Выбери Python или C++.');
    const id=randomUUID();
    if(!await r.createDuel({id,invite:newToken().slice(0,16),language:p.language,userId:user.id},now))fail(409,'Сначала заверши текущую дуэль.');
    send(201,{id});return true;
  }
  if(route==='/api/account/duels/join'&&req.method==='POST'){
    if(!user)fail(401,'Войди в аккаунт.');await limit('duel-join:'+user.id,20);
    const p=await body(req,2048),invite=typeof p.invite==='string'?p.invite.trim().toLowerCase().replaceAll(' ',''):'';
    if(!/^[a-f0-9]{16}$/.test(invite))fail(400,'Проверь код приглашения.');
    if(!await judge.status())fail(503,'Проверяющий сервер недоступен.');
    const id=await r.joinDuel(invite,user.id,now);if(!id)fail(409,'Комната недоступна, заполнена или у тебя уже есть дуэль.');
    send(200,{id});return true;
  }
  const duel=route.match(/^\/api\/account\/duels\/([a-f0-9-]{36})(?:\/(ready|leave|submit))?$/);
  if(duel){
    if(!user)fail(401,'Войди в аккаунт.');
    const room=await r.getDuel(duel[1],user.id,now);if(!room)fail(404,'Дуэль не найдена.');
    if(req.method==='GET'&&!duel[2]){
      const {self,...publicRoom}=room;
      send(200,{...publicRoom,level:self.completed,task:room.status==='active'&&now>=room.start_at&&self.completed<5?duelTask(room.language,self.completed):null});return true;
    }
    if(req.method==='POST'){
      const p=await body(req,128000);
      if(duel[2]==='ready'){
        if(!await judge.status())fail(503,'Проверяющий сервер недоступен.');
        if(!await r.readyDuel(room.id,user.id,now))fail(409,'Дуэль уже началась или истекла.');
      }else if(duel[2]==='leave'){
        if(!await r.leaveDuel(room.id,user.id,now))fail(409,'Дуэль уже завершена.');
      }else if(duel[2]==='submit'){
        await limit('duel-submit:'+user.id,6,60000);
        if(!judge.enabled)fail(503,'Проверка не подключена.');
        if(typeof p.source!=='string'||p.source.length<1||p.source.length>30000||p.level!==room.self.completed)fail(400,'Некорректное решение.');
        const id=randomUUID(),codeHash=hashToken(p.source);
        if(!await r.beginSubmission({id,duelId:room.id,userId:user.id,level:p.level,codeHash},now))fail(409,'Дуэль не активна или решение уже проверяется.');
        // Return immediately; the server owns the result and the client polls it.
        void judge.check({id,version:duelVersion,language:room.language,level:p.level,source:p.source}).then(verdict=>r.finishSubmission(id,verdict,clock())).catch(()=>r.finishSubmission(id,{status:'error',message:'Проверка недоступна. Отправь решение снова.'},clock())).catch(()=>{});
        send(202,{id});return true;
      }else return false;
      send(200,{ok:true});return true;
    }
  }
  return false;
}
