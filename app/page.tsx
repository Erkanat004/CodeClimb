"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Code2, Flag, HelpCircle, Maximize2, Minus, Mountain, Play, Plus, RotateCcw, Send, Square, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import PythonEditor from '@/components/python-editor';
import { nodes as classicNodes, pythonLiteral, starter } from '@/lib/challenges';
import { cppStarter, cppProgram } from '@/lib/cpp-challenges';
import { startSandbox, type Language } from '@/lib/sandbox';
import { AccountProvider, AccountButton, useAccount, accountRequest } from '@/components/account';
import { RewardHint } from '@/components/reward-hint';

import { getChallenges, difficulties, difficultyLabels, type Difficulty } from '@/lib/catalog';
import {sameProgressContent} from '@/lib/progress';

type Result = { results: { passed:boolean; actual:string; expected:string }[]; error?:string; stdout?:string; ms?:number };
type Status = 'idle' | 'loading' | 'compiling' | 'running' | 'passed' | 'failed';

function Avatar({ kind=0, className='' }: { kind?:number; className?:string }) {
  return <svg viewBox="0 0 32 36" className={`avatar ${className}`} aria-hidden="true">
    {kind%4===0 ? <><path d="M4 16Q3 2 16 2Q29 2 28 16V29L23 34H9L4 29Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12Q16 6 24 12V25Q16 35 8 25Z" fill="currentColor"/><path d="M10 17h5v4h-5zm7 0h5v4h-5z" fill="#123745"/></> : kind%4===1 ? <><path d="M5 14Q5 2 16 2Q27 2 27 14" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 13H25V25L20 33H12L7 25Z" fill="currentColor"/><path d="M8 17h16v5H8z" fill="#123745"/><path d="M2 15h4v12H2zm24 0h4v12h-4z" fill="currentColor"/></> : kind%4===2 ? <><path d="M8 6H24L26 14H6Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M2 15h28" stroke="currentColor" strokeWidth="2"/><path d="M7 17H25V26Q16 38 7 26Z" fill="currentColor"/><path d="M9 20h5v3H9zm9 0h5v3h-5zM13 28h6" stroke="#123745" strokeWidth="2"/></> : <><path d="M6 12L3 6l8 3L16 1l5 8 8-3-3 6v12Q16 39 6 24Z" fill="currentColor"/><path d="m9 17 5 3-5 2m14-5-5 3 5 2" fill="none" stroke="#123745" strokeWidth="2"/></>}
  </svg>;
}

export default function Home() {
  return <AccountProvider><HomeContent/></AccountProvider>;
}
function HomeContent() {
  const {user,ready}=useAccount();
  const [language,setLanguage]=useState<Language>('python');
  const [difficulty,setDifficulty]=useState<Difficulty>('full');
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(!active)return;try{if(localStorage.getItem('code-climb-language')==='cpp')setLanguage('cpp');const d=localStorage.getItem('code-climb-difficulty') as Difficulty;if(difficulties.includes(d))setDifficulty(d);}catch{}});return()=>{active=false;};},[]);
  return <Game key={`${language}-${difficulty}-${ready?user?.id??'guest':'loading'}`} difficulty={difficulty} changeDifficulty={value=>{setDifficulty(value);try{localStorage.setItem('code-climb-difficulty',value);}catch{}}} language={language} changeLanguage={value=>{setLanguage(value);try{localStorage.setItem('code-climb-language',value);}catch{}}}/>;
}
function Game({language,difficulty,changeLanguage,changeDifficulty}:{language:Language;difficulty:Difficulty;changeLanguage:(v:Language)=>void;changeDifficulty:(v:Difficulty)=>void}) {
  const {user,ready}=useAccount();
  const STORE=difficulty==='classic'?(language==='python'?'code-climb-python-v2':'code-climb-cpp-v1'):`code-climb-${language}-${difficulty}-v1`;
  const progressPath=`progress/${language}/${difficulty}`;
  const label=language==='python'?'Python':'C++';
  const tasks=getChallenges(language,difficulty),count=tasks.length;
  const nodes=difficulty==='classic'?classicNodes:tasks.map((_,i)=>({id:i+1,x:classicNodes[Math.round(i*14/(count-1))].x,y:1680-i*1470/(count-1)}));
  const route=nodes.map((n,i)=>i?`V${n.y}H${n.x}`:`M${n.x},${n.y}`).join(' ');
  const altitude=(n:number)=>Math.round(n/count*8848);
  const starterCode=language==='python'?starter:cppStarter;
  const displayValue=(v:unknown)=>language==='python'?pythonLiteral(v):JSON.stringify(v);
  const [hydrated,setHydrated] = useState(false);
  const [saveStatus,setSaveStatus]=useState('Загрузка прогресса…');
  const revision=useRef(0), saving=useRef(false), failedSave=useRef(false), lastSaved=useRef('');
  const lastGuest=useRef<string|null>(null);
  const latest=useRef({completed:0,drafts:{} as Record<number,string>,avatar:0,seconds:0});
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
  const worker = useRef<{terminate:()=>void}|null>(null);
  const animation = useRef<number>(0);
  const challenge = tasks[selected];
  const current = nodes[Math.min(completed,count-1)];
  const code = drafts[selected] ?? starterCode(challenge);
  const busy = !hydrated || status==='loading' || status==='compiling' || status==='running' || moving;
  const round = Math.min(Math.ceil(count/5),Math.floor(completed/5)+1);
  const cameraY = overview ? 0 : Math.max(0,Math.min(1020, current.y-550));
  const time = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;

  useEffect(()=>{
    let active=true;
    async function load(){if(!ready)return;
    try {
      const saved=user?await accountRequest(progressPath):null;
      if(!user)lastGuest.current=localStorage.getItem(STORE);
      const p=saved?saved.data as {completed:number;drafts:Record<number,string>;avatar:number;seconds:number}:JSON.parse(lastGuest.current||'null');
      if(!active)return;
      revision.current=saved?Number(saved.revision):0;
      if(p && Number.isInteger(p.completed) && p.completed>=0 && p.completed<=count) {
        setCompleted(p.completed); setSelected(Math.min(p.completed,count-1)); setPosition(nodes[Math.min(p.completed,count-1)]);
        if(p.drafts && typeof p.drafts==='object') setDrafts(Object.fromEntries(Object.entries(p.drafts).filter(([k,v])=>Number(k)>=0&&Number(k)<count&&typeof v==='string'&&v.length<=30000)) as Record<number,string>);
        if(Number.isInteger(p.avatar)&&p.avatar>=0&&p.avatar<4) setAvatar(p.avatar);
        if(Number.isFinite(p.seconds)&&p.seconds>=0) setSeconds(Math.floor(p.seconds));
      }
      if(saved)lastSaved.current=JSON.stringify(p);
      setSaveStatus(user?'Сохранено в SQLite':'Гостевой прогресс в браузере');setHydrated(true);
    }catch{if(!active)return;if(user){setSaveStatus('Не удалось загрузить аккаунт. Обнови страницу; данные не перезаписаны.');}else{setSaveStatus('Гостевой режим без сохранения');setHydrated(true);}}
    }
    void load();
    return ()=>{active=false;worker.current?.terminate();cancelAnimationFrame(animation.current);};
  },[]);
  useEffect(()=>{
    latest.current={completed,drafts,avatar,seconds};
    if(!hydrated||user)return;
    let active=true;
    void Promise.resolve().then(()=>{
      if(!active)return;
      try{
        if(localStorage.getItem(STORE)!==lastGuest.current){setHydrated(false);setSaveStatus('Прогресс изменён в другой вкладке. Скопируй черновик и обнови страницу.');return;}
        const value=JSON.stringify(latest.current);localStorage.setItem(STORE,value);lastGuest.current=value;
      }catch{setSaveStatus('Не удалось сохранить в браузере');}
    });
    return()=>{active=false;};
  },[hydrated,completed,drafts,avatar,seconds]);
  async function saveAccount(){
    if(!user)return true;
    if(!hydrated||saving.current||failedSave.current)return false;
    const snapshot=JSON.stringify(latest.current);if(snapshot===lastSaved.current)return true;
    saving.current=true;setSaveStatus('Сохранение…');
    try{const p=await accountRequest(progressPath,'PUT',{data:JSON.parse(snapshot),revision:revision.current});revision.current=Number(p.revision);lastSaved.current=snapshot;const unchanged=sameProgressContent(JSON.stringify(latest.current),snapshot);setSaveStatus(unchanged?'Сохранено в SQLite':'Есть новые изменения — сохраняем…');return unchanged;}
    catch(e){if((e as {status?:number}).status===409||(e as {status?:number}).status===401)failedSave.current=true;setSaveStatus(e instanceof Error?e.message:'Сохранение не удалось. Повторим автоматически.');return false;}
    finally{saving.current=false;}
  }
  useEffect(()=>{if(!user||!hydrated)return;const id=setTimeout(()=>{setSaveStatus('Есть несохранённые изменения…');void saveAccount();},700);return()=>clearTimeout(id);},[hydrated,completed,drafts,avatar]);
  useEffect(()=>{if(!user||!hydrated)return;const id=setInterval(()=>void saveAccount(),10000);return()=>clearInterval(id);},[hydrated]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(user&&hydrated&&!sameProgressContent(JSON.stringify(latest.current),lastSaved.current)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[hydrated]);
  useEffect(()=>{if(!hydrated||completed===count)return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id);},[hydrated,completed]);

  function select(index:number) {
    if(busy||index>completed)return;
    setSelected(index); setEditorOpen(true); setResult(null); setStatus('idle'); setHint(false);
    if(window.innerWidth<=820) requestAnimationFrame(()=>document.querySelector('.workbench')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  function stop() {
    worker.current?.terminate();worker.current=null;
    setStatus('failed');setResult({results:[],error:'Выполнение остановлено. Прогресс не изменён.'});
  }
  function advance(index:number) {
    if(index!==completed||completed>=count)return;
    if(completed===count-1){setCompleted(count);setSummit(true);return;}
    setMoving(true);setOverview(false);
    // This function only runs after the player's submit action, never during render.
    // eslint-disable-next-line react-hooks/purity
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
    const tests=submit?challenge.tests:challenge.tests.slice(0,2);
    if(code.length>30000){setStatus('failed');setResult({results:[],error:'Код длиннее 30 000 символов.'});return;}
    worker.current=startSandbox(language,{code:language==='cpp'?cppProgram(code,challenge,tests):code,fn:challenge.fn,tests},setStatus,data=>{
      worker.current=null;setResult(data);
      const passed=!data.error&&data.results.length===tests.length&&data.results.every(r=>r.passed);
      setStatus(passed?'passed':'failed');if(passed&&submit)advance(index);
    });
  }
  function resetRoute(){stop();setCompleted(0);setSelected(0);setPosition(nodes[0]);setDrafts({});setSeconds(0);setResult(null);setStatus('idle');setReset(false);setSummit(false);setOverview(false);}

  return <main className={`climb-app ${editorOpen?'with-editor':''}`}>
    <header className="topbar">
      <a className="wordmark" href="#" onClick={e=>{e.preventDefault();setOverview(v=>!v);}}><Mountain size={26}/><span>CODE<span className="wordmark-light">CLIMB</span></span></a>
      <div className="top-center"><div className="language-switch" role="group" aria-label="Язык программирования"><button disabled={busy} aria-pressed={language==='python'} onClick={async()=>{if(await saveAccount())changeLanguage('python');}}>Python</button><button disabled={busy} aria-pressed={language==='cpp'} onClick={async()=>{if(await saveAccount())changeLanguage('cpp');}}>C++</button></div><span className="top-separator"/><span>THE ASCENT / 01</span></div>
      <div className="top-actions"><button onClick={()=>setHelp(true)} aria-label="Как играть"><HelpCircle size={19}/></button><button className="account-button" disabled={busy} onClick={async()=>{if(await saveAccount())window.location.assign('/compete');}}>Соревнование</button>{user?.role==='admin'&&<button className="account-button" disabled={busy} onClick={async()=>{if(await saveAccount())window.location.assign('/admin');}}>Админка</button>}<AccountButton disabled={busy} beforeChange={saveAccount}/><button className="profile-toggle" onClick={()=>setProfile(true)} aria-label="Выбрать аватар"><Avatar kind={avatar}/><span>{user?.username??'you'}</span></button></div>
    </header>

    <div className="difficulty-bar">
      <label htmlFor="difficulty">Маршрут</label>
      <select id="difficulty" value={difficulty} disabled={busy} onChange={async e=>{const next=e.target.value as Difficulty;if(difficulties.includes(next)&&await saveAccount())changeDifficulty(next);}}>
        {difficulties.map(d=><option key={d} value={d}>{difficultyLabels[d]}{d==='classic'||d==='full'?' · 15 уровней':''}</option>)}
      </select>
      <span>{count} задач · {difficulty==='full'?'5 лёгких + 5 средних + 5 сложных':difficulty==='classic'?'прежний прогресс сохранён':'свой маршрут и прогресс'}</span>
    </div>
    <div className="play-layout">
      {editorOpen && <aside className="workbench" aria-label={`Редактор ${label}`}>
        <div className="workbench-title"><span><Code2 size={17}/> WORKSPACE</span><button aria-label="Свернуть редактор" onClick={()=>setEditorOpen(false)}><Minus size={18}/></button></div>
        <div className="brief">
          <div className="checkpoint-meta"><span>CHECKPOINT {String(selected+1).padStart(2,'0')}</span><span>{selected<completed?'ПРОЙДЕН':language==='python'?'PYTHON 3':'C++20'}</span></div>
          <h1>{challenge.title}</h1><p className="topic">{challenge.topic}</p>
          <p className="description">{challenge.description}</p>
          <div className="example"><span>ПРИМЕР</span><code>{challenge.fn}({challenge.tests[0].args.map(displayValue).join(', ')})</code><code className="expected">→ {displayValue(challenge.tests[0].expected)}</code></div>
          <div className="constraint">{challenge.constraint}</div>
          <button className="hint-toggle" onClick={()=>setHint(v=>!v)}>{hint?'− Скрыть подсказку':'+ Подсказка'}</button>
          {hint&&<><p className="hint-text">{challenge.hint}</p><RewardHint key={`${language}-${challenge.id}`} language={language} taskId={challenge.id}/></>}
        </div>
        <div className="file-tab"><span><i/> {language==='python'?'solution.py':'solution.cpp'}</span><span>UTF-8</span></div>
        <div className="code-pane">{hydrated&&<PythonEditor language={language} value={code} disabled={busy} onChange={v=>setDrafts(p=>({...p,[selected]:v}))}/>}</div>
        <div className={`console status-${status}`} aria-live="polite">
          <div className="console-heading"><span>CONSOLE</span><span>{result?.ms!==undefined?`${result.ms} ms`:`${label.toUpperCase()} / SANDBOX`}</span></div>
          {status==='idle'&&<p><b>›</b> Готов к запуску. Верни ответ из функции.</p>}
          {status==='loading'&&<p className="loading-text">Подключение {label}… {language==='cpp'?'При первом запуске загрузится около 30 МБ.':'Первый запуск займёт несколько секунд.'}</p>}
          {status==='compiling'&&<p className="loading-text">Компиляция C++20…</p>}
          {status==='running'&&<p className="loading-text">Выполнение тестов…</p>}
          {result?.error&&<pre>{result.error}</pre>}
          {!!result?.results.length&&<><div className="test-dots">{result.results.map((r,i)=><span key={i} className={r.passed?'pass':'fail'} title={r.passed?'Пройден':'Ошибка'}>{String(i+1).padStart(2,'0')} {r.passed?'✓':'×'}</span>)}</div><p>{result.results.filter(r=>r.passed).length} / {result.results.length} тестов пройдено {moving?'· ПОДЪЁМ…':''}</p>{result.results.some(r=>!r.passed)&&<pre>Ожидалось: {result.results.find(r=>!r.passed)?.expected}{'\n'}Получено: {result.results.find(r=>!r.passed)?.actual}</pre>}</>}
          {result?.stdout&&<pre>{result.stdout}</pre>}
        </div>
        <div className="runbar"><button className="icon-button" disabled={busy} aria-label="Сбросить код" onClick={()=>setDrafts(p=>({...p,[selected]:starterCode(challenge)}))}><RotateCcw size={16}/></button>{status==='loading'||status==='compiling'||status==='running'?<button className="run-button" onClick={stop}><Square size={13}/> СТОП</button>:<button className="run-button" onClick={()=>run(false)} disabled={busy}><Play size={14}/> RUN</button>}<button className="submit-button" onClick={()=>run(true)} disabled={busy}><Send size={14}/> SUBMIT <ChevronRight size={15}/></button></div>
        <div className="local-note">Изолированный запуск · без сети и файлов компьютера</div>
        <div className="save-status" role="status">{saveStatus}</div>
      </aside>}

      <section className={`arena ${overview?'overview':''}`} aria-label="Карта восхождения">
        <svg className="cliff-world" viewBox={`0 ${cameraY} 1000 ${overview?1850:800}`} preserveAspectRatio={overview?'xMidYMid meet':'xMidYMid slice'} aria-label={`Маршрут из ${count} задач`}>
          <defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#032837" stopOpacity=".05"/><stop offset="1" stopColor="#001c30" stopOpacity=".55"/></linearGradient></defs>
          <image href="/cliff.png" x="0" y="0" width="1000" height="1850" preserveAspectRatio="xMidYMid slice"/>
          <rect width="1000" height="1850" fill="url(#shade)"/>
          {(difficulty==='classic'?[180,705,1230]:[180]).map((y,i)=><g key={y} className="round-boundary"><path d={`M-100 ${y+20} L140 ${y+10} L320 ${y+18} L520 ${y+5} L710 ${y+15} L1100 ${y}`} /><text x="70" y={y-6}>{difficulty==='classic'?`ROUND 0${3-i}`:difficultyLabels[difficulty].toUpperCase()}</text></g>)}
          <path d={route} className="route-underlay"/><path d={route} className="route-future"/>
          {completed>0&&<path d={nodes.slice(0,Math.min(completed+1,count)).map((n,i)=>i?`V${n.y}H${n.x}`:`M${n.x},${n.y}`).join(' ')} className="route-done"/>}
          {nodes.map((n,i)=><g key={n.id} className={`checkpoint ${i<completed?'cleared':i===completed?'active':'locked'}`} role="button" aria-label={`Уровень ${n.id}: ${tasks[i].title}${i>completed?', заблокирован':''}`} aria-disabled={i>completed||busy} tabIndex={i<=completed?0:-1} onClick={()=>select(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}}}>
            <title>{`${n.id}. ${tasks[i].title}`}</title><rect x={n.x-23} y={n.y-23} width="46" height="46" fill="transparent"/><rect className="checkpoint-box" x={n.x-8} y={n.y-8} width="16" height="16"/>
            <text x={n.x+27} y={n.y+5} className="node-label">{String(n.id).padStart(2,'0')}</text>
            {i<completed&&<path d={`m${n.x-4},${n.y} 3,3 5,-6`} className="node-tick"/>}
          </g>)}
          <g className="you-marker" transform={`translate(${position.x-62},${position.y-19})`}><rect x="-7" y="-6" width="42" height="46" rx="3"/><foreignObject width="28" height="34"><Avatar kind={avatar}/></foreignObject><text x="14" y="-16" textAnchor="middle">YOU</text></g>
          <g transform="translate(555,154)" className="summit-flag"><path d="M0 0V-45H35L24-33l11 12H0"/><text x="0" y="-60" textAnchor="middle">SUMMIT</text></g>
          <text className="base-label" x="660" y="1740" textAnchor="middle">BASE CAMP</text>
        </svg>
        <div className="arena-shade"/>
        <div className="arena-top">
          <div className="round-info"><span className="eyebrow">{label.toUpperCase()} · {difficultyLabels[difficulty].toUpperCase()}</span><h2>Round <span>{String(round).padStart(2,'0')}</span></h2><div className="round-segments">{[0,1,2,3,4].map(i=><i key={i} className={i<completed%5||completed===count?'filled':''}/>)}</div><p>Тренировка <span>· без рейтинга</span></p></div>
          <button className="minimap" onClick={()=>setOverview(v=>!v)} title={overview?'Вернуться к игроку':'Показать всю гору'} aria-label={overview?'Вернуться к игроку':'Показать всю гору'}><Mountain/><span>{overview?'К ИГРОКУ':'ОБЗОР ГОРЫ'}</span></button>
        </div>
        <div className="arena-stats"><span><b>{altitude(completed).toLocaleString('ru-RU')}</b> м</span><i/><span>{completed}<small>/{count}</small><label>ПРОЙДЕНО</label></span><i/><span>{time}<label>ВРЕМЯ</label></span></div>
        <div className="map-controls">{!editorOpen&&<button onClick={()=>setEditorOpen(true)} aria-label="Открыть редактор"><Code2 size={19}/></button>}<button onClick={()=>setOverview(false)} aria-label="Приблизить маршрут" disabled={!overview}><Plus size={19}/></button><button onClick={()=>setOverview(true)} aria-label="Показать всю гору" disabled={overview}><Minus size={19}/></button><button onClick={()=>setEditorOpen(v=>!v)} aria-label="Развернуть карту"><Maximize2 size={17}/></button></div>
        <div className="stage-caption"><span>STAGE {String(Math.min(completed+1,count)).padStart(2,'0')} / {count}</span><strong>{completed===count?'SUMMIT REACHED':tasks[Math.min(completed,count-1)].title}</strong><button onClick={()=>select(Math.min(completed,count-1))} disabled={busy}>{completed===count?'Повторить задачу':'Открыть задачу'} <ChevronRight size={16}/></button></div>
        {moving&&<div className="clear-message" role="status"><Flag size={24}/><span>CHECKPOINT CLEARED</span><small>Следующая высота…</small></div>}
        <div className="map-bottom"><span>{user?'ЛОКАЛЬНАЯ БД · SQLITE':'ГОСТЕВОЙ РЕЖИМ'}</span><span>БЕЛЫЙ — МАРШРУТ <i className="key-yellow"/> ТЫ</span></div>
      </section>

      <aside className="standings" aria-label="Тренировочный прогресс"><div className="standings-head"><Trophy size={17}/><span>TRAINING</span><small>СОЛО</small></div><div className="your-rank"><span>ТВОЙ ПРОГРЕСС</span><strong>{String(completed).padStart(2,'0')}<small>/{count}</small></strong></div><ol><li className="is-you"><span className="rank-no">01</span><Avatar kind={avatar}/><span className="racer"><b>{user?.username??'you'}</b><small>{label} · {difficultyLabels[difficulty]}</small></span><span className="racer-altitude">{altitude(completed).toLocaleString('ru-RU')}<small> м</small></span></li></ol><div className="summit-distance"><Flag size={19}/><span>ДО ВЕРШИНЫ<b>{(8848-altitude(completed)).toLocaleString('ru-RU')} м</b></span></div><p className="race-note">Тренировка разрешает вставку кода и подсказки. Для честной дуэли открой режим соревнования.</p><button className="restart-link" onClick={async()=>{if(await saveAccount())window.location.assign('/compete');}} disabled={busy}><Trophy size={13}/> Соревнование</button><button className="restart-link" onClick={()=>setReset(true)} disabled={busy}><RotateCcw size={13}/> Начать заново</button></aside>
    </div>

    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="small-dialog"><DialogTitle>Как подняться на вершину</DialogTitle><DialogDescription>Выбери язык и сложность. В каждом новом наборе пять разных задач. Старый маршрут доступен отдельно; прогресс всех наборов независим.</DialogDescription><ol className="help-steps"><li>Нажми на текущий квадрат маршрута и прочитай задачу.</li><li>Напиши функцию любым подходящим способом. RUN запускает два примера. В C++ функция main не нужна.</li><li>SUBMIT проверяет все пять тестов. Верное решение поднимает твой аватар.</li></ol><p>Войди, чтобы сохранять решения в локальной SQLite. Без аккаунта прогресс остаётся в этом браузере; гостевые решения автоматически в аккаунт не переносятся.</p><p>Тренировка выполняется в браузерной песочнице без сети и файлов компьютера. Защищённая серверная проверка и запрет вставки включаются в режиме соревнования.</p><button className="submit-button" onClick={()=>setHelp(false)}>Понятно</button></DialogContent></Dialog>
    <Dialog open={profile} onOpenChange={setProfile}><DialogContent className="small-dialog"><DialogTitle>Твой аватар</DialogTitle><DialogDescription>Выбери значок, по которому узнаешь себя на скале.</DialogDescription><div className="avatar-picker">{[0,1,2,3].map(n=><button key={n} onClick={()=>{setAvatar(n);setProfile(false);}} className={avatar===n?'chosen':''} aria-label={`Аватар ${n+1}`} aria-pressed={avatar===n}><Avatar kind={n}/></button>)}</div></DialogContent></Dialog>
    <Dialog open={reset} onOpenChange={setReset}><DialogContent className="small-dialog"><DialogTitle>Начать восхождение заново?</DialogTitle><DialogDescription>Прогресс {label} · {difficultyLabels[difficulty]} и решения будут удалены {user?'из текущего аккаунта':'из этого браузера'}. Другие языки и уровни сложности не изменятся.</DialogDescription><div className="dialog-actions"><button className="run-button" onClick={()=>setReset(false)}>Отмена</button><button className="submit-button" onClick={resetRoute}>Начать заново</button></div></DialogContent></Dialog>
    <Dialog open={summit} onOpenChange={setSummit}><DialogContent className="small-dialog summit-dialog"><Flag size={48}/><DialogTitle>SUMMIT REACHED</DialogTitle><DialogDescription>8 848 м · {label.toUpperCase()} CLIMB COMPLETED</DialogDescription><p>Все {count} задач пройдены.<br/>Время восхождения: {time}</p><button className="submit-button" onClick={()=>{setSummit(false);setOverview(true);}}>Посмотреть маршрут</button></DialogContent></Dialog>
  </main>;
}
