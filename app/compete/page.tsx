"use client";
import Link from 'next/link';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronRight, Copy, Flag, Home, Play, RefreshCcw, Send, ShieldCheck, Trophy, Users} from 'lucide-react';
import PythonEditor from '@/components/python-editor';
import {AccountButton, AccountProvider, accountRequest, useAccount} from '@/components/account';

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
      try{await loadRoom(room.id);}catch(e){setError(e instanceof Error?e.message:'Не удалось обновить дуэль.');}
      finally{polling.current=false;}
    },room.status==='active'?1500:2500);
    return()=>clearInterval(id);
  },[room?.id,room?.status,user?.id]);
  useEffect(()=>{
    if(!room?.task||taskKey===lastTask.current)return;
    lastTask.current=taskKey;setSource(room.task.starter);
  },[taskKey,room?.task]);

  async function action(fn:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await fn();}
    catch(e){setError(e instanceof Error?e.message:'Действие не выполнено.');}
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
    catch(e){setChecking(false);setError(e instanceof Error?e.message:'Сервер не принял решение.');}
  }
  async function copyInvite(){
    if(!room)return;
    await navigator.clipboard?.writeText(room.invite).catch(()=>{});
  }

  const verdict=useMemo(()=>{
    if(!room?.submission)return '';
    if(room.submission.status==='pending')return 'Сервер проверяет решение…';
    if(room.submission.status==='passed')return room.submission.verdict??'Задача пройдена.';
    return room.submission.verdict??'Решение не прошло проверку.';
  },[room?.submission]);

  if(!ready)return <main className="duel-app"><div className="duel-center">Загрузка аккаунта…</div></main>;
  if(!user)return <main className="duel-app"><header className="duel-top"><Link href="/" className="wordmark"><Trophy size={24}/><span>CODE<span className="wordmark-light">CLIMB</span></span></Link><AccountButton disabled={false} beforeChange={async()=>true}/></header><div className="duel-center"><ShieldCheck size={42}/><h1>Соревнование доступно после входа</h1><p>Дуэль хранится на сервере: общий старт, одинаковые задачи и проверка без клиентских тестов.</p></div></main>;

  return <main className="duel-app">
    <header className="duel-top">
      <Link href="/" className="wordmark"><Trophy size={24}/><span>CODE<span className="wordmark-light">CLIMB</span></span></Link>
      <nav><Link href="/"><Home size={16}/> Тренировка</Link><AccountButton disabled={busy} beforeChange={async()=>true}/></nav>
    </header>
    <section className="duel-hero">
      <div><span className="admin-eyebrow">COMPETITION MODE</span><h1>Честная дуэль на 5 задач</h1><p>Два игрока, один язык, общий таймер 20 минут. Подсказки и реклама выключены, вставка в редакторе заблокирована, результат принимает только серверный проверяющий.</p></div>
      <div className="duel-health"><ShieldCheck/><span>{judgeReady?'Judge подключён':'Judge не подключён'}</span></div>
    </section>
    <section className="duel-grid">
      <aside className="duel-panel">
        <h2>Комната</h2>
        <div className="language-switch duel-language" role="group" aria-label="Язык дуэли"><button disabled={busy} aria-pressed={language==='python'} onClick={()=>setLanguage('python')}>Python</button><button disabled={busy} aria-pressed={language==='cpp'} onClick={()=>setLanguage('cpp')}>C++</button></div>
        <button className="submit-button" disabled={busy||!judgeReady} onClick={()=>void action(create)}><Play size={14}/> Создать дуэль</button>
        <form className="duel-join" onSubmit={e=>{e.preventDefault();void action(join);}}>
          <label>Код приглашения<input value={joinCode} onChange={e=>setJoinCode(e.target.value)} maxLength={19} placeholder="16 символов" disabled={busy}/></label>
          <button className="run-button" disabled={busy||!judgeReady}>Войти</button>
        </form>
        {!!rooms.length&&<div className="duel-list"><span>Последние комнаты</span>{rooms.map(r=><button key={r.id} className={room?.id===r.id?'active':''} onClick={()=>void action(()=>loadRoom(r.id).then(()=>{}))}>{languageLabel[r.language]} · {r.status}</button>)}</div>}
        <p className="field-note">Это не защита от всех обходов на своём компьютере, но честная проверка результата и прогресса выполняется на сервере.</p>
      </aside>
      <section className="duel-stage">
        {!room?<div className="duel-empty"><Users size={44}/><h2>Создай комнату или введи код друга</h2><p>Когда оба игрока нажмут «Готов», старт начнётся через 5 секунд.</p></div>:<>
          <div className="duel-room-head">
            <div><span className="admin-eyebrow">{languageLabel[room.language]} · {room.status.toUpperCase()}</span><h2>{finished?room.status==='cancelled'?'Комната отменена':'Дуэль завершена':started?'Задача '+(room.level+1):'Ожидание старта'}</h2></div>
            <div className="duel-code"><span>{room.invite}</span><button onClick={()=>void copyInvite()} title="Скопировать код"><Copy size={15}/></button></div>
          </div>
          <div className="duel-score">
            {room.players.map(p=><div key={p.user_id} className={p.user_id===user.id?'self':''}><strong>{p.username}</strong><span>{p.completed}/5</span><small>{p.ready?'готов':'ожидает'}</small></div>)}
            {room.players.length<2&&<div><strong>Другой игрок</strong><span>0/5</span><small>ждём код</small></div>}
          </div>
          <div className="duel-clock"><Flag size={17}/>{countdown>0?'Старт через '+msClock(countdown):finished?winner?'Победитель: '+winner.username:room.status==='cancelled'?'Дуэль отменена':'Ничья':started?'Осталось '+msClock(remaining):'Готовность игроков'}</div>
          {room.status==='waiting'&&<div className="duel-actions"><button className="submit-button" disabled={busy||Boolean(me?.ready)||room.players.length<2} onClick={()=>void action(readyUp)}>Готов</button><button className="run-button" disabled={busy} onClick={()=>void action(leave)}>Выйти</button></div>}
          {room.status==='active'&&!started&&<p className="duel-wait">Приготовься. Редактор откроется после общего старта.</p>}
          {started&&room.task&&<div className="duel-work">
            <div className="brief duel-brief"><div className="checkpoint-meta"><span>CHECKPOINT {String(room.level+1).padStart(2,'0')}</span><span>{languageLabel[room.language]} · SERVER JUDGE</span></div><h2>{room.task.title}</h2><p className="description">{room.task.description}</p><div className="example"><span>ПРИМЕР</span><code>{room.task.example}</code></div><div className="constraint">{room.task.constraint}</div></div>
            <div className="file-tab"><span><i/> {room.language==='python'?'duel.py':'duel.cpp'}</span><span>NO PASTE</span></div>
            <div className="duel-editor"><PythonEditor language={room.language} value={source} disabled={busy||checking||pending||finished} noPaste onChange={setSource}/></div>
            <div className={`console status-${room.submission?.status==='passed'?'passed':room.submission?.status==='failed'||room.submission?.status==='error'?'failed':'idle'}`}><div className="console-heading"><span>SERVER CONSOLE</span><span>{pending||checking?'CHECKING':'READY'}</span></div><p>{verdict||'Отправь решение. Клиент не знает скрытые тесты и не может засчитать уровень сам.'}</p></div>
            <div className="runbar"><button className="icon-button" disabled={busy||checking||pending} onClick={()=>setSource(room.task!.starter)} aria-label="Сбросить код"><RefreshCcw size={16}/></button><button className="submit-button" disabled={busy||checking||pending||finished||source.trim().length===0} onClick={()=>void submit()}><Send size={14}/> Отправить на сервер <ChevronRight size={15}/></button></div>
          </div>}
          {finished&&<div className="duel-actions"><button className="submit-button" onClick={()=>void action(create)}>Новая дуэль</button><button className="run-button" onClick={()=>window.location.assign('/')}>В тренировку</button></div>}
        </>}
        {error&&<p className="auth-error duel-error" role="alert">{error}</p>}
      </section>
    </section>
  </main>;
}
