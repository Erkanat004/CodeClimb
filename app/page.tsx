"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Code2, Flag, HelpCircle, Maximize2, Minus, Mountain, Play, Plus, RotateCcw, Send, Square, Trophy, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import PythonEditor from '@/components/python-editor';
import { altitude, challenges, nodes, pythonLiteral, starter } from '@/lib/challenges';

type Result = { results: { passed:boolean; actual:string; expected:string }[]; error?:string; stdout?:string; ms?:number };
type Status = 'idle' | 'loading' | 'running' | 'passed' | 'failed';
const STORE = 'code-climb-python-v2';
const botNames = ['nova','cipher','raven','byte','ghost','zero','echo','root'];
const route = nodes.map((n,i) => i ? `V${n.y}H${n.x}` : `M${n.x},${n.y}`).join(' ');

function Avatar({ kind=0, className='' }: { kind?:number; className?:string }) {
  return <svg viewBox="0 0 32 36" className={`avatar ${className}`} aria-hidden="true">
    {kind%4===0 ? <><path d="M4 16Q3 2 16 2Q29 2 28 16V29L23 34H9L4 29Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12Q16 6 24 12V25Q16 35 8 25Z" fill="currentColor"/><path d="M10 17h5v4h-5zm7 0h5v4h-5z" fill="#123745"/></> : kind%4===1 ? <><path d="M5 14Q5 2 16 2Q27 2 27 14" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 13H25V25L20 33H12L7 25Z" fill="currentColor"/><path d="M8 17h16v5H8z" fill="#123745"/><path d="M2 15h4v12H2zm24 0h4v12h-4z" fill="currentColor"/></> : kind%4===2 ? <><path d="M8 6H24L26 14H6Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M2 15h28" stroke="currentColor" strokeWidth="2"/><path d="M7 17H25V26Q16 38 7 26Z" fill="currentColor"/><path d="M9 20h5v3H9zm9 0h5v3h-5zM13 28h6" stroke="#123745" strokeWidth="2"/></> : <><path d="M6 12L3 6l8 3L16 1l5 8 8-3-3 6v12Q16 39 6 24Z" fill="currentColor"/><path d="m9 17 5 3-5 2m14-5-5 3 5 2" fill="none" stroke="#123745" strokeWidth="2"/></>}
  </svg>;
}

export default function Home() {
  const [hydrated,setHydrated] = useState(false);
  const [completed,setCompleted] = useState(0);
  const [drafts,setDrafts] = useState<Record<number,string>>({});
  const [selected,setSelected] = useState(0);
  const [seconds,setSeconds] = useState(0);
  const [avatar,setAvatar] = useState(0);
  const [editorOpen,setEditorOpen] = useState(true);
  const [overview,setOverview] = useState(false);
  const [help,setHelp] = useState(false);
  const [profile,setProfile] = useState(false);
  const [reset,setReset] = useState(false);
  const [summit,setSummit] = useState(false);
  const [hint,setHint] = useState(false);
  const [status,setStatus] = useState<Status>('idle');
  const [result,setResult] = useState<Result|null>(null);
  const [moving,setMoving] = useState(false);
  const [position,setPosition] = useState(nodes[0]);
  const worker = useRef<Worker|null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const animation = useRef<number>(0);
  const challenge = challenges[selected];
  const current = nodes[Math.min(completed,14)];
  const code = drafts[selected] ?? starter(challenge);
  const busy = status==='loading' || status==='running' || moving;
  const round = Math.min(3,Math.floor(completed/5)+1);
  const cameraY = overview ? 0 : Math.max(0,Math.min(1020, current.y-550));
  const opponents = botNames.map((name,i)=>({name,kind:i%4,level:Math.min(13,[3,2,2,1,1,0,0,0][i]+Math.floor(seconds/(100+i*29)))}));
  const ranking = [...opponents.map(b=>({...b,you:false})),{name:'you',kind:avatar,level:completed,you:true}].sort((a,b)=>b.level-a.level);
  const place = ranking.findIndex(p=>p.you)+1;
  const time = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;

  useEffect(()=>{
    try {
      const p=JSON.parse(localStorage.getItem(STORE)||'null');
      if(p && Number.isInteger(p.completed) && p.completed>=0 && p.completed<=15) {
        setCompleted(p.completed); setSelected(Math.min(p.completed,14)); setPosition(nodes[Math.min(p.completed,14)]);
        if(p.drafts && typeof p.drafts==='object') setDrafts(Object.fromEntries(Object.entries(p.drafts).filter(([k,v])=>Number(k)>=0&&Number(k)<15&&typeof v==='string'&&v.length<=30000)) as Record<number,string>);
        if(Number.isInteger(p.avatar)&&p.avatar>=0&&p.avatar<4) setAvatar(p.avatar);
        if(Number.isFinite(p.seconds)&&p.seconds>=0) setSeconds(Math.floor(p.seconds));
      }
    } catch { /* A blocked or invalid local store must not block play. */ }
    setHydrated(true);
    return ()=>{ worker.current?.terminate(); if(timer.current)clearTimeout(timer.current); cancelAnimationFrame(animation.current); };
  },[]);
  useEffect(()=>{if(hydrated)try{localStorage.setItem(STORE,JSON.stringify({completed,drafts,avatar,seconds}));}catch{/* Session remains playable. */}},[hydrated,completed,drafts,avatar,seconds]);
  useEffect(()=>{if(!hydrated||completed===15)return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id);},[hydrated,completed]);

  function select(index:number) {
    if(busy||index>completed)return;
    setSelected(index); setEditorOpen(true); setResult(null); setStatus('idle'); setHint(false);
    if(window.innerWidth<=820) requestAnimationFrame(()=>document.querySelector('.workbench')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  function stop() {
    worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);
    setStatus('failed');setResult({results:[],error:'Выполнение остановлено. Прогресс не изменён.'});
  }
  function advance(index:number) {
    if(index!==completed||completed>=15)return;
    if(completed===14){setCompleted(15);setSummit(true);return;}
    setMoving(true);setOverview(false);
    const from=nodes[index], to=nodes[index+1], startTime=performance.now();
    const vertical=Math.abs(to.y-from.y), horizontal=Math.abs(to.x-from.x), length=vertical+horizontal;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(now:number){
      const t=Math.min(1,(now-startTime)/(reduced?1:900));const distance=t*length;
      setPosition({...to,x:distance<=vertical?from.x:from.x+Math.sign(to.x-from.x)*(distance-vertical),y:distance<=vertical?from.y-distance:to.y});
      if(t<1)animation.current=requestAnimationFrame(frame);
      else{setCompleted(index+1);setSelected(index+1);setMoving(false);setStatus('idle');setResult(null);setHint(false);}
    }
    animation.current=requestAnimationFrame(frame);
  }
  function run(submit:boolean) {
    if(busy)return;
    const index=selected;setStatus('loading');setResult(null);
    const w=new Worker('/python-worker.mjs',{type:'module'});worker.current=w;
    function dispose(){w.terminate();if(worker.current===w)worker.current=null;if(timer.current)clearTimeout(timer.current);}
    timer.current=setTimeout(()=>{dispose();setStatus('failed');setResult({results:[],error:'Python не загрузился за 45 секунд. Проверь соединение и повтори запуск.'});},45000);
    w.onmessage=({data})=>{
      if(worker.current!==w)return;
      if(data.type==='ready'){
        if(timer.current)clearTimeout(timer.current);setStatus('running');
        timer.current=setTimeout(()=>{dispose();setStatus('failed');setResult({results:[],error:'TIME LIMIT EXCEEDED · Выполнение дольше 3 секунд. Проверь циклы и алгоритм.'});},3000);
      } else if(data.type==='result') {
        dispose();setResult(data);const passed=!data.error&&data.results.length>0&&data.results.every((r:{passed:boolean})=>r.passed);
        setStatus(passed?'passed':'failed');if(passed&&submit)advance(index);
      } else if(data.type==='error'){dispose();setStatus('failed');setResult({results:[],error:data.error});}
    };
    w.onerror=()=>{dispose();setStatus('failed');setResult({results:[],error:'Не удалось запустить Python. Повтори попытку.'});};
    w.postMessage({code,fn:challenge.fn,tests:submit?challenge.tests:challenge.tests.slice(0,2)});
  }
  function resetRoute(){stop();setCompleted(0);setSelected(0);setPosition(nodes[0]);setDrafts({});setSeconds(0);setResult(null);setStatus('idle');setReset(false);setSummit(false);setOverview(false);}

  return <main className={`climb-app ${editorOpen?'with-editor':''}`}>
    <header className="topbar">
      <a className="wordmark" href="#" onClick={e=>{e.preventDefault();setOverview(v=>!v);}}><Mountain size={26}/><span>CODE<span className="wordmark-light">CLIMB</span></span></a>
      <div className="top-center"><span className="python-label"><Code2 size={16}/> PYTHON</span><span className="top-separator"/><span>THE ASCENT / 01</span></div>
      <div className="top-actions"><button onClick={()=>setHelp(true)} aria-label="Как играть"><HelpCircle size={19}/></button><button className="profile-toggle" onClick={()=>setProfile(true)} aria-label="Выбрать аватар"><Avatar kind={avatar}/><span>you</span></button></div>
    </header>

    <div className="play-layout">
      {editorOpen && <aside className="workbench" aria-label="Редактор Python">
        <div className="workbench-title"><span><Code2 size={17}/> WORKSPACE</span><button aria-label="Свернуть редактор" onClick={()=>setEditorOpen(false)}><Minus size={18}/></button></div>
        <div className="brief">
          <div className="checkpoint-meta"><span>CHECKPOINT {String(selected+1).padStart(2,'0')}</span><span>{selected<completed?'ПРОЙДЕН':'PYTHON 3'}</span></div>
          <h1>{challenge.title}</h1><p className="topic">{challenge.topic}</p>
          <p className="description">{challenge.description}</p>
          <div className="example"><span>ПРИМЕР</span><code>{challenge.fn}({challenge.tests[0].args.map(pythonLiteral).join(', ')})</code><code className="expected">→ {pythonLiteral(challenge.tests[0].expected)}</code></div>
          <div className="constraint">{challenge.constraint}</div>
          <button className="hint-toggle" onClick={()=>setHint(v=>!v)}>{hint?'− Скрыть подсказку':'+ Подсказка'}</button>
          {hint&&<p className="hint-text">{challenge.hint}</p>}
        </div>
        <div className="file-tab"><span><i/> solution.py</span><span>UTF-8</span></div>
        <div className="code-pane">{hydrated&&<PythonEditor value={code} disabled={busy} onChange={v=>setDrafts(p=>({...p,[selected]:v}))}/>}</div>
        <div className={`console status-${status}`} aria-live="polite">
          <div className="console-heading"><span>CONSOLE</span><span>{result?.ms!==undefined?`${result.ms} ms`:'PYTHON / LOCAL'}</span></div>
          {status==='idle'&&<p><b>›</b> Готов к запуску. Верни ответ из функции.</p>}
          {status==='loading'&&<p className="loading-text">Подключение Python… Первый запуск займёт несколько секунд.</p>}
          {status==='running'&&<p className="loading-text">Выполнение тестов…</p>}
          {result?.error&&<pre>{result.error}</pre>}
          {!!result?.results.length&&<><div className="test-dots">{result.results.map((r,i)=><span key={i} className={r.passed?'pass':'fail'} title={r.passed?'Пройден':'Ошибка'}>{String(i+1).padStart(2,'0')} {r.passed?'✓':'×'}</span>)}</div><p>{result.results.filter(r=>r.passed).length} / {result.results.length} тестов пройдено {moving?'· ПОДЪЁМ…':''}</p>{result.results.some(r=>!r.passed)&&<pre>Ожидалось: {result.results.find(r=>!r.passed)?.expected}{'\n'}Получено: {result.results.find(r=>!r.passed)?.actual}</pre>}</>}
          {result?.stdout&&<pre>{result.stdout}</pre>}
        </div>
        <div className="runbar"><button className="icon-button" disabled={busy} aria-label="Сбросить код" onClick={()=>setDrafts(p=>({...p,[selected]:starter(challenge)}))}><RotateCcw size={16}/></button>{status==='loading'||status==='running'?<button className="run-button" onClick={stop}><Square size={13}/> СТОП</button>:<button className="run-button" onClick={()=>run(false)} disabled={busy}><Play size={14}/> RUN</button>}<button className="submit-button" onClick={()=>run(true)} disabled={busy}><Send size={14}/> SUBMIT <ChevronRight size={15}/></button></div>
        <div className="local-note">Тренировочный режим · тесты выполняются в браузере</div>
      </aside>}

      <section className={`arena ${overview?'overview':''}`} aria-label="Карта восхождения">
        <svg className="cliff-world" viewBox={`0 ${cameraY} 1000 ${overview?1850:800}`} preserveAspectRatio={overview?'xMidYMid meet':'xMidYMid slice'} aria-label="Маршрут из 15 задач">
          <defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#032837" stopOpacity=".05"/><stop offset="1" stopColor="#001c30" stopOpacity=".55"/></linearGradient></defs>
          <image href="/cliff.png" x="0" y="0" width="1000" height="1850" preserveAspectRatio="xMidYMid slice"/>
          <rect width="1000" height="1850" fill="url(#shade)"/>
          {[180,705,1230].map((y,i)=><g key={y} className="round-boundary"><path d={`M-100 ${y+20} L140 ${y+10} L320 ${y+18} L520 ${y+5} L710 ${y+15} L1100 ${y}`} /><text x="70" y={y-6}>ROUND 0{3-i}</text></g>)}
          <path d={route} className="route-underlay"/><path d={route} className="route-future"/>
          {completed>0&&<path d={nodes.slice(0,Math.min(completed+1,15)).map((n,i)=>i?`V${n.y}H${n.x}`:`M${n.x},${n.y}`).join(' ')} className="route-done"/>}
          {nodes.map((n,i)=><g key={n.id} className={`checkpoint ${i<completed?'cleared':i===completed?'active':'locked'}`} role="button" aria-label={`Уровень ${n.id}: ${challenges[i].title}${i>completed?', заблокирован':''}`} aria-disabled={i>completed||busy} tabIndex={i<=completed?0:-1} onClick={()=>select(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}}}>
            <title>{`${n.id}. ${challenges[i].title}`}</title><rect x={n.x-23} y={n.y-23} width="46" height="46" fill="transparent"/><rect className="checkpoint-box" x={n.x-8} y={n.y-8} width="16" height="16"/>
            <text x={n.x+27} y={n.y+5} className="node-label">{String(n.id).padStart(2,'0')}</text>
            {i<completed&&<path d={`m${n.x-4},${n.y} 3,3 5,-6`} className="node-tick"/>}
          </g>)}
          {opponents.map((b,i)=>{const n=nodes[b.level];const peers=opponents.slice(0,i).filter(x=>x.level===b.level).length;return <g key={b.name} transform={`translate(${n.x-150-(peers%3)*31},${n.y-20-Math.floor(peers/3)*42})`} className="opponent"><title>{`${b.name} · бот · уровень ${b.level+1}`}</title><foreignObject width="24" height="28"><Avatar kind={b.kind}/></foreignObject></g>;})}
          <g className="you-marker" transform={`translate(${position.x-62},${position.y-19})`}><rect x="-7" y="-6" width="42" height="46" rx="3"/><foreignObject width="28" height="34"><Avatar kind={avatar}/></foreignObject><text x="14" y="-16" textAnchor="middle">YOU</text></g>
          <g transform="translate(555,154)" className="summit-flag"><path d="M0 0V-45H35L24-33l11 12H0"/><text x="0" y="-60" textAnchor="middle">SUMMIT</text></g>
          <text className="base-label" x="660" y="1740" textAnchor="middle">BASE CAMP</text>
        </svg>
        <div className="arena-shade"/>
        <div className="arena-top">
          <div className="round-info"><span className="eyebrow">PYTHON CHALLENGE</span><h2>Round <span>{String(round).padStart(2,'0')}</span></h2><div className="round-segments">{[0,1,2,3,4].map(i=><i key={i} className={i<completed%5||completed===15?'filled':''}/>)}</div><p>9 участников <span>· с ботами</span></p></div>
          <button className="minimap" onClick={()=>setOverview(v=>!v)} title={overview?'Вернуться к игроку':'Показать всю гору'} aria-label={overview?'Вернуться к игроку':'Показать всю гору'}><Mountain/><span>{overview?'К ИГРОКУ':'ОБЗОР ГОРЫ'}</span></button>
        </div>
        <div className="arena-stats"><span><b>{altitude(completed).toLocaleString('ru-RU')}</b> м</span><i/><span>{completed}<small>/15</small><label>ПРОЙДЕНО</label></span><i/><span>{time}<label>ВРЕМЯ</label></span></div>
        <div className="map-controls">{!editorOpen&&<button onClick={()=>setEditorOpen(true)} aria-label="Открыть редактор"><Code2 size={19}/></button>}<button onClick={()=>setOverview(false)} aria-label="Приблизить маршрут" disabled={!overview}><Plus size={19}/></button><button onClick={()=>setOverview(true)} aria-label="Показать всю гору" disabled={overview}><Minus size={19}/></button><button onClick={()=>setEditorOpen(v=>!v)} aria-label="Развернуть карту"><Maximize2 size={17}/></button></div>
        <div className="stage-caption"><span>STAGE {String(Math.min(completed+1,15)).padStart(2,'0')} / 15</span><strong>{completed===15?'SUMMIT REACHED':challenges[Math.min(completed,14)].title}</strong><button onClick={()=>select(Math.min(completed,14))} disabled={busy}>{completed===15?'Повторить задачу':'Открыть задачу'} <ChevronRight size={16}/></button></div>
        {moving&&<div className="clear-message" role="status"><Flag size={24}/><span>CHECKPOINT CLEARED</span><small>Следующая высота…</small></div>}
        <div className="map-bottom"><span><i className="status-dot"/> СОХРАНЕНО ЛОКАЛЬНО</span><span>БЕЛЫЙ — МАРШРУТ <i className="key-yellow"/> ТЫ</span></div>
      </section>

      <aside className="standings" aria-label="Рейтинг с ботами"><div className="standings-head"><Trophy size={17}/><span>CLIMBERS</span><small>БОТЫ</small></div><div className="your-rank"><span>ТВОЯ ПОЗИЦИЯ</span><strong>{String(place).padStart(2,'0')}<small>/09</small></strong></div><ol>{ranking.map((p,i)=><li key={p.name} className={p.you?'is-you':''}><span className="rank-no">{String(i+1).padStart(2,'0')}</span><Avatar kind={p.kind}/><span className="racer"><b>{p.name}</b><small>{p.you?'ты':`бот · ${p.level}/15`}</small></span><span className="racer-altitude">{altitude(p.level).toLocaleString('ru-RU')}<small> м</small></span></li>)}</ol><div className="summit-distance"><Flag size={19}/><span>ДО ВЕРШИНЫ<b>{(8848-altitude(completed)).toLocaleString('ru-RU')} м</b></span></div><p className="race-note">Решай задачи и поднимайся выше. Каждый пройденный тест приближает вершину.</p><button className="restart-link" onClick={()=>setReset(true)} disabled={busy}><RotateCcw size={13}/> Начать заново</button></aside>
    </div>

    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="small-dialog"><DialogTitle>Как подняться на вершину</DialogTitle><DialogDescription>15 задач Python. Три этапа. Один маршрут.</DialogDescription><ol className="help-steps"><li>Нажми на текущий квадрат маршрута и прочитай задачу.</li><li>Напиши функцию в редакторе. RUN запускает два примера.</li><li>SUBMIT проверяет все тесты задачи. Верное решение поднимает твой аватар.</li></ol><p>Прогресс хранится в этом браузере. Соперники — боты. Проверка локальная: тесты доступны клиенту; это тренировочная версия без серверного рейтинга.</p><button className="submit-button" onClick={()=>setHelp(false)}>Понятно <ChevronRight size={16}/></button></DialogContent></Dialog>
    <Dialog open={profile} onOpenChange={setProfile}><DialogContent className="small-dialog"><DialogTitle>Твой аватар</DialogTitle><DialogDescription>Выбери значок, по которому узнаешь себя на скале.</DialogDescription><div className="avatar-picker">{[0,1,2,3].map(n=><button key={n} onClick={()=>{setAvatar(n);setProfile(false);}} className={avatar===n?'chosen':''} aria-label={`Аватар ${n+1}`} aria-pressed={avatar===n}><Avatar kind={n}/></button>)}</div></DialogContent></Dialog>
    <Dialog open={reset} onOpenChange={setReset}><DialogContent className="small-dialog"><DialogTitle>Начать восхождение заново?</DialogTitle><DialogDescription>Прогресс Python и сохранённые решения этой версии будут удалены из браузера.</DialogDescription><div className="dialog-actions"><button className="run-button" onClick={()=>setReset(false)}>Отмена</button><button className="submit-button" onClick={resetRoute}>Начать заново</button></div></DialogContent></Dialog>
    <Dialog open={summit} onOpenChange={setSummit}><DialogContent className="small-dialog summit-dialog"><Flag size={48}/><DialogTitle>SUMMIT REACHED</DialogTitle><DialogDescription>8 848 м · PYTHON CLIMB COMPLETED</DialogDescription><p>Все 15 задач пройдены.<br/>Время восхождения: {time}</p><button className="submit-button" onClick={()=>{setSummit(false);setOverview(true);}}>Посмотреть маршрут</button></DialogContent></Dialog>
  </main>;
}
