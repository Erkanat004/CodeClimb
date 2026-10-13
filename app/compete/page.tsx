"use client";
import Link from 'next/link';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronRight, Copy, Flag, Home, Play, RefreshCcw, Send, ShieldCheck, Trophy, Users} from 'lucide-react';
import PythonEditor from '@/components/python-editor';
import {AccountButton, AccountProvider, accountRequest, useAccount} from '@/components/account';
import {LanguageSwitcher,useLanguage} from '@/lib/i18n';
import {localizeDuelTask} from '@/lib/challenge-translations';

type Language='python'|'cpp';
type Player={user_id:string;username:string;ready:number;completed:number;last_pass_at:number|null};
type Task={fn:string;title:string;description:string;signature:string;constraint:string;example:string;starter:string};
type Submission={id:string;level:number;status:string;verdict:string|null;received_at:number}|null;
type Room={id:string;invite:string;language:Language;status:'waiting'|'active'|'finished'|'cancelled';start_at:number|null;end_at:number|null;winner_id:string|null;finished_at:number|null;players:Player[];submission:Submission;now:number;observedAt:number;level:number;task:Task|null};
type RoomSummary={id:string;invite:string;language:Language;status:Room['status'];created_at:number;start_at:number|null;end_at:number|null;winner_id:string|null};

const languageLabel={python:'Python',cpp:'C++'};

function msClock(ms:number){
  const total=Math.max(0,Math.ceil(ms/1000));
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

export default function CompetePage(){
  return <AccountProvider><CompeteShell/></AccountProvider>;
}

function CompeteShell(){
  const {user,ready}=useAccount();
  return <Compete key={ready?user?.id??'guest':'loading'}/>;
}

function Compete(){
  const {user,ready}=useAccount();
  const {language:uiLanguage,t}=useLanguage();
  const [language,setLanguage]=useState<Language>('python');
  const [rooms,setRooms]=useState<RoomSummary[]>([]);
  const [room,setRoom]=useState<Room|null>(null);
  const [joinCode,setJoinCode]=useState('');
  const [source,setSource]=useState('');
  const [busy,setBusy]=useState(false);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState('');
  const [judgeReady,setJudgeReady]=useState(false);
  const [tick,setTick]=useState(Date.now());
  const lastTask=useRef('');
  const polling=useRef(false);
  const now=room?room.now+Math.max(0,tick-room.observedAt):tick;
  const me=room?.players.find(p=>p.user_id===user?.id);
  const taskKey=room?.task?`${room.id}:${room.level}:${room.task.fn}`:'';
  const started=room?.status==='active'&&room.start_at!==null&&now>=room.start_at;
  const finished=room?.status==='finished'||room?.status==='cancelled';
  const pending=room?.submission?.status==='pending';
  const countdown=room?.status==='active'&&room.start_at&&now<room.start_at?room.start_at-now:0;
  const remaining=room?.status==='active'&&room.end_at?room.end_at-now:0;
  const winner=room?.winner_id?room.players.find(p=>p.user_id===room.winner_id):null;
  const displayTask=room?.task?localizeDuelTask(room.task,uiLanguage):null;

  useEffect(()=>{const id=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(id);},[]);
  async function loadList(){
    if(!user)return;
    const data=await accountRequest('duels') as {ready:boolean;rooms:RoomSummary[]};
    setJudgeReady(data.ready);setRooms(data.rooms);
    if(!room&&data.rooms[0])void loadRoom(data.rooms[0].id);
  }
  async function loadRoom(id:string){
    const data=await accountRequest('duels/'+id) as unknown as Room;
    setRoom({...data,observedAt:Date.now()});
    if(data.submission?.status&&data.submission.status!=='pending')setChecking(false);
    setRooms(prev=>prev.map(r=>r.id===data.id?{...r,status:data.status,start_at:data.start_at,end_at:data.end_at,winner_id:data.winner_id}:r));
    return data;
  }
  useEffect(()=>{let active=true;if(ready&&user)void Promise.resolve().then(()=>{if(active)void loadList().catch(e=>setError(e.message));});return()=>{active=false;};},[ready,user?.id]);
  useEffect(()=>{
    if(!room||!user)return;
    const id=setInterval(async()=>{
      if(polling.current)return;
      polling.current=true;
      try{await loadRoom(room.id);}catch(e){setError(e instanceof Error?e.message:t('Не удалось обновить дуэль.','Could not refresh the duel.'));}
      finally{polling.current=false;}
    },room.status==='active'?1500:2500);
    return()=>clearInterval(id);
  },[room?.id,room?.status,user?.id]);
  useEffect(()=>{
    if(!room?.task||taskKey===lastTask.current)return;
    lastTask.current=taskKey;setSource(localizeDuelTask(room.task,uiLanguage).starter);
  },[taskKey,room?.task]);

  async function action(fn:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await fn();}
    catch(e){setError(e instanceof Error?e.message:t('Действие не выполнено.','The action failed.'));}
    finally{setBusy(false);}
  }
  async function create(){
    const data=await accountRequest('duels','POST',{language}) as {id:string};
    await loadList();await loadRoom(data.id);
  }
  async function join(){
    const data=await accountRequest('duels/join','POST',{invite:joinCode}) as {id:string};
    setJoinCode('');await loadList();await loadRoom(data.id);
  }
  async function readyUp(){
    if(!room)return;await accountRequest('duels/'+room.id+'/ready','POST',{});await loadRoom(room.id);
  }
  async function leave(){
    if(!room)return;await accountRequest('duels/'+room.id+'/leave','POST',{});await loadRoom(room.id);
  }
  async function submit(){
    if(!room||!room.task||!started||pending||checking)return;
    setChecking(true);setError('');
    try{await accountRequest('duels/'+room.id+'/submit','POST',{level:room.level,source});await loadRoom(room.id);}
    catch(e){setChecking(false);setError(e instanceof Error?e.message:t('Сервер не принял решение.','The server did not accept the solution.'));}
  }
  async function copyInvite(){
    if(!room)return;
    await navigator.clipboard?.writeText(room.invite).catch(()=>{});
  }

  const verdict=useMemo(()=>{
    if(!room?.submission)return '';
    if(room.submission.status==='pending')return t('Сервер проверяет решение…','Server is checking your solution…');
    if(room.submission.status==='passed')return uiLanguage==='en'? 'Challenge cleared.':room.submission.verdict??'Задача пройдена.';
    return uiLanguage==='en'? 'Solution did not pass. Review your code and try again.':room.submission.verdict??'Решение не прошло проверку.';
  },[room?.submission,uiLanguage]);

  if(!ready)return <main className="duel-app"><div className="duel-center">{t('Загрузка аккаунта…','Loading account…')}</div></main>;
  if(!user)return <main className="duel-app"><header className="duel-top"><Link href="/" className="wordmark"><Trophy size={24}/><span>CODE<span className="wordmark-light">CLIMB</span></span></Link><LanguageSwitcher/><AccountButton disabled={false} beforeChange={async()=>true}/></header><div className="duel-center"><ShieldCheck size={42}/><h1>{t('Соревнование доступно после входа','Sign in to compete')}</h1><p>{t('Дуэль хранится на сервере: общий старт, одинаковые задачи и проверка без клиентских тестов.','Duels are stored on the server, with a shared start, identical challenges, and server-side checking.')}</p></div></main>;

  return <main className="duel-app">
    <header className="duel-top">
      <Link href="/" className="wordmark"><Trophy size={24}/><span>CODE<span className="wordmark-light">CLIMB</span></span></Link>
      <nav><Link href="/"><Home size={16}/> {t('Тренировка','Training')}</Link><LanguageSwitcher/><AccountButton disabled={busy} beforeChange={async()=>true}/></nav>
    </header>
    <section className="duel-hero">
      <div><span className="admin-eyebrow">COMPETITION MODE</span><h1>{t('Честная дуэль на 5 задач','A fair five-challenge duel')}</h1><p>{t('Два игрока, один язык, общий таймер 20 минут. Подсказки и реклама выключены, вставка в редакторе заблокирована, результат принимает только серверный проверяющий.','Two players, one language, a shared 20-minute timer. Hints and ads are off; pasting is blocked and only the server judge accepts results.')}</p></div>
      <div className="duel-health"><ShieldCheck/><span>{judgeReady?t('Judge подключён','Judge connected'):t('Judge не подключён','Judge unavailable')}</span></div>
    </section>
    <section className="duel-grid">
      <aside className="duel-panel">
        <h2>{t('Комната','Room')}</h2>
        <div className="language-switch duel-language" role="group" aria-label={t('Язык дуэли','Duel language')}><button disabled={busy} aria-pressed={language==='python'} onClick={()=>setLanguage('python')}>Python</button><button disabled={busy} aria-pressed={language==='cpp'} onClick={()=>setLanguage('cpp')}>C++</button></div>
        <button className="submit-button" disabled={busy||!judgeReady} onClick={()=>void action(create)}><Play size={14}/> {t('Создать дуэль','Create duel')}</button>
        <form className="duel-join" onSubmit={e=>{e.preventDefault();void action(join);}}>
          <label>{t('Код приглашения','Invite code')}<input value={joinCode} onChange={e=>setJoinCode(e.target.value)} maxLength={19} placeholder={t('16 символов','16 characters')} disabled={busy}/></label>
          <button className="run-button" disabled={busy||!judgeReady}>{t('Войти','Join')}</button>
        </form>
        {!!rooms.length&&<div className="duel-list"><span>{t('Последние комнаты','Recent rooms')}</span>{rooms.map(r=><button key={r.id} className={room?.id===r.id?'active':''} onClick={()=>void action(()=>loadRoom(r.id).then(()=>{}))}>{languageLabel[r.language]} · {r.status}</button>)}</div>}
        <p className="field-note">{t('Это не защита от всех обходов на своём компьютере, но честная проверка результата и прогресса выполняется на сервере.','Local paste blocking cannot prevent every workaround, but results and progress are checked on the server.')}</p>
      </aside>
      <section className="duel-stage">
        {!room?<div className="duel-empty"><Users size={44}/><h2>{t('Создай комнату или введи код друга','Create a room or enter a friend’s code')}</h2><p>{t('Когда оба игрока нажмут «Готов», старт начнётся через 5 секунд.','When both players are ready, the duel starts in five seconds.')}</p></div>:<>
          <div className="duel-room-head">
            <div><span className="admin-eyebrow">{languageLabel[room.language]} · {room.status.toUpperCase()}</span><h2>{finished?room.status==='cancelled'?t('Комната отменена','Room cancelled'):t('Дуэль завершена','Duel finished'):started?t('Задача ','Challenge ')+(room.level+1):t('Ожидание старта','Waiting to start')}</h2></div>
            <div className="duel-code"><span>{room.invite}</span><button onClick={()=>void copyInvite()} title={t('Скопировать код','Copy code')}><Copy size={15}/></button></div>
          </div>
          <div className="duel-score">
            {room.players.map(p=><div key={p.user_id} className={p.user_id===user.id?'self':''}><strong>{p.username}</strong><span>{p.completed}/5</span><small>{p.ready?t('готов','ready'):t('ожидает','waiting')}</small></div>)}
            {room.players.length<2&&<div><strong>{t('Другой игрок','Other player')}</strong><span>0/5</span><small>{t('ждём код','waiting for code')}</small></div>}
          </div>
          <div className="duel-clock"><Flag size={17}/>{countdown>0?t('Старт через ','Starting in ')+msClock(countdown):finished?winner?t('Победитель: ','Winner: ')+winner.username:room.status==='cancelled'?t('Дуэль отменена','Duel cancelled'):t('Ничья','Draw'):started?t('Осталось ','Remaining ')+msClock(remaining):t('Готовность игроков','Waiting for players')}</div>
          {room.status==='waiting'&&<div className="duel-actions"><button className="submit-button" disabled={busy||Boolean(me?.ready)||room.players.length<2} onClick={()=>void action(readyUp)}>{t('Готов','Ready')}</button><button className="run-button" disabled={busy} onClick={()=>void action(leave)}>{t('Выйти','Leave')}</button></div>}
          {room.status==='active'&&!started&&<p className="duel-wait">{t('Приготовься. Редактор откроется после общего старта.','Get ready. The editor opens after the shared start.')}</p>}
          {started&&room.task&&<div className="duel-work">
            <div className="brief duel-brief"><div className="checkpoint-meta"><span>CHECKPOINT {String(room.level+1).padStart(2,'0')}</span><span>{languageLabel[room.language]} · SERVER JUDGE</span></div><h2>{displayTask?.title}</h2><p className="description">{displayTask?.description}</p><div className="example"><span>{t('ПРИМЕР','EXAMPLE')}</span><code>{room.task.example}</code></div><div className="constraint">{displayTask?.constraint}</div></div>
            <div className="file-tab"><span><i/> {room.language==='python'?'duel.py':'duel.cpp'}</span><span>NO PASTE</span></div>
            <div className="duel-editor"><PythonEditor language={room.language} value={source} disabled={busy||checking||pending||finished} noPaste onChange={setSource}/></div>
            <div className={`console status-${room.submission?.status==='passed'?'passed':room.submission?.status==='failed'||room.submission?.status==='error'?'failed':'idle'}`}><div className="console-heading"><span>SERVER CONSOLE</span><span>{pending||checking?'CHECKING':'READY'}</span></div><p>{verdict||t('Отправь решение. Клиент не знает скрытые тесты и не может засчитать уровень сам.','Submit your solution. The client cannot see hidden tests or award progress itself.')}</p></div>
            <div className="runbar"><button className="icon-button" disabled={busy||checking||pending} onClick={()=>setSource(displayTask!.starter)} aria-label={t('Сбросить код','Reset code')}><RefreshCcw size={16}/></button><button className="submit-button" disabled={busy||checking||pending||finished||source.trim().length===0} onClick={()=>void submit()}><Send size={14}/> {t('Отправить на сервер','Submit to server')} <ChevronRight size={15}/></button></div>
          </div>}
          {finished&&<div className="duel-actions"><button className="submit-button" onClick={()=>void action(create)}>{t('Новая дуэль','New duel')}</button><button className="run-button" onClick={()=>window.location.assign('/')}>{t('В тренировку','Back to training')}</button></div>}
        </>}
        {error&&<p className="auth-error duel-error" role="alert">{error}</p>}
      </section>
    </section>
  </main>;
}
