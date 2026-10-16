"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Code2, Flag, HelpCircle, Maximize2, Minimize2, Minus, Mountain, Play, Plus, RotateCcw, Send, Square, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import PythonEditor from '@/components/python-editor';
import { nodes as classicNodes, pythonLiteral, starter } from '@/lib/challenges';
import { cppStarter, cppProgram } from '@/lib/cpp-challenges';
import { startSandbox, type Language } from '@/lib/sandbox';
import { AccountProvider, AccountButton, useAccount, accountRequest } from '@/components/account';
import { RewardHint } from '@/components/reward-hint';
import {LanguageSwitcher,useLanguage} from '@/lib/i18n';
import {difficultyLabel,localizeChallenge} from '@/lib/challenge-translations';

import { getChallenges, difficulties, type Difficulty } from '@/lib/catalog';
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
  const {language:uiLanguage,t}=useLanguage();
  const STORE=difficulty==='classic'?(language==='python'?'code-climb-python-v2':'code-climb-cpp-v1'):`code-climb-${language}-${difficulty}-v1`;
  const progressPath=`progress/${language}/${difficulty}`;
  const label=language==='python'?'Python':'C++';
  const tasks=getChallenges(language,difficulty),count=tasks.length;
  const displayTasks=tasks.map(task=>localizeChallenge(task,uiLanguage));
  const difficultyName=(value:Difficulty)=>difficultyLabel(value,uiLanguage);
  const nodes=difficulty==='classic'?classicNodes:tasks.map((_,i)=>({id:i+1,x:classicNodes[Math.round(i*14/(count-1))].x,y:1680-i*1470/(count-1)}));
  const route=nodes.map((n,i)=>i?`V${n.y}H${n.x}`:`M${n.x},${n.y}`).join(' ');
  const altitude=(n:number)=>Math.round(n/count*8848);
  const starterCode=(task:typeof tasks[number])=>{
    const source=language==='python'?starter(task):cppStarter(task);
    return uiLanguage==='en'?source.replace('Напиши своё решение здесь','Write your solution here').replace('Напиши решение. main() добавляется автоматически.','Write your solution. main() is added automatically.'):source;
  };
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
  const [terminalExpanded,setTerminalExpanded] = useState(false);
  const [overview,setOverview] = useState(false);
  const [help,setHelp] = useState(false);
  const [profile,setProfile] = useState(false);
  const [reset,setReset] = useState(false);
  const [summit,setSummit] = useState(false);
  const [hint,setHint] = useState(false);
  const [status,setStatus] = useState<Status>('idle');
  const [result,setResult] = useState<Result|null>(null);
  const [resultCheckpoint,setResultCheckpoint] = useState<number|null>(null);
  const [terminalCommand,setTerminalCommand] = useState('submit');
  const [lastCommand,setLastCommand] = useState<string|null>(null);
  const [commandError,setCommandError] = useState('');
  const [moving,setMoving] = useState(false);
  const [position,setPosition] = useState(nodes[0]);
  const worker = useRef<{terminate:()=>void}|null>(null);
  const animation = useRef<number>(0);
  const challenge = tasks[selected];
  const displayChallenge=displayTasks[selected];
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
      setSaveStatus(user?t('Прогресс сохранён','Progress saved'):t('Гостевой прогресс в браузере','Guest progress in this browser'));setHydrated(true);
    }catch{if(!active)return;if(user){setSaveStatus(t('Не удалось загрузить аккаунт. Обнови страницу; данные не перезаписаны.','Could not load your account. Refresh the page; your data was not overwritten.'));}else{setSaveStatus(t('Гостевой режим без сохранения','Guest mode without saved progress'));setHydrated(true);}}
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
        if(localStorage.getItem(STORE)!==lastGuest.current){setHydrated(false);setSaveStatus(t('Прогресс изменён в другой вкладке. Скопируй черновик и обнови страницу.','Progress changed in another tab. Copy your draft and refresh this page.'));return;}
        const value=JSON.stringify(latest.current);localStorage.setItem(STORE,value);lastGuest.current=value;
      }catch{setSaveStatus(t('Не удалось сохранить в браузере','Could not save in the browser'));}
    });
    return()=>{active=false;};
  },[hydrated,completed,drafts,avatar,seconds]);
  async function saveAccount(){
    if(!user)return true;
    if(!hydrated||saving.current||failedSave.current)return false;
    const snapshot=JSON.stringify(latest.current);if(snapshot===lastSaved.current)return true;
    saving.current=true;setSaveStatus(t('Сохранение…','Saving…'));
    try{const p=await accountRequest(progressPath,'PUT',{data:JSON.parse(snapshot),revision:revision.current});revision.current=Number(p.revision);lastSaved.current=snapshot;const unchanged=sameProgressContent(JSON.stringify(latest.current),snapshot);setSaveStatus(unchanged?t('Прогресс сохранён','Progress saved'):t('Есть новые изменения — сохраняем…','New changes — saving…'));return unchanged;}
    catch(e){if((e as {status?:number}).status===409||(e as {status?:number}).status===401)failedSave.current=true;setSaveStatus(e instanceof Error?e.message:t('Сохранение не удалось. Повторим автоматически.','Save failed. We will retry automatically.'));return false;}
    finally{saving.current=false;}
  }
  useEffect(()=>{if(!user||!hydrated)return;const id=setTimeout(()=>{setSaveStatus(t('Есть несохранённые изменения…','Unsaved changes…'));void saveAccount();},700);return()=>clearTimeout(id);},[hydrated,completed,drafts,avatar]);
  useEffect(()=>{if(!user||!hydrated)return;const id=setInterval(()=>void saveAccount(),10000);return()=>clearInterval(id);},[hydrated]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(user&&hydrated&&!sameProgressContent(JSON.stringify(latest.current),lastSaved.current)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[hydrated]);
  useEffect(()=>{if(!hydrated||completed===count)return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id);},[hydrated,completed]);

  function select(index:number) {
    if(busy||index>completed)return;
    setSelected(index); setEditorOpen(true); setResult(null); setResultCheckpoint(null); setStatus('idle'); setHint(false); setLastCommand(null); setCommandError('');
    if(window.innerWidth<=820) requestAnimationFrame(()=>document.querySelector('.challenge-card')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  function stop() {
    worker.current?.terminate();worker.current=null;
    setStatus('failed');setResult({results:[],error:t('Выполнение остановлено. Прогресс не изменён.','Execution stopped. Progress was not changed.')});
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
      else{setCompleted(index+1);setSelected(index+1);setMoving(false);setHint(false);}
    }
    animation.current=requestAnimationFrame(frame);
  }
  function run(submit:boolean) {
    if(busy)return;
    const index=selected;setStatus('loading');setResult(null);setResultCheckpoint(index+1);setLastCommand(submit?'submit':'run');setCommandError('');
    const tests=submit?challenge.tests:challenge.tests.slice(0,2);
    if(code.length>30000){setStatus('failed');setResult({results:[],error:t('Код длиннее 30 000 символов.','Code exceeds 30,000 characters.')});return;}
    worker.current=startSandbox(language,{code:language==='cpp'?cppProgram(code,challenge,tests):code,fn:challenge.fn,tests},setStatus,data=>{
      worker.current=null;setResult(data);
      const passed=!data.error&&data.results.length===tests.length&&data.results.every(r=>r.passed);
      setStatus(passed?'passed':'failed');if(passed&&submit)advance(index);
    });
  }
  function executeTerminalCommand() {
    const command=terminalCommand.trim().toLowerCase();
    if(command==='run')run(false);
    else if(command==='submit')run(true);
    else setCommandError(t('Команды: run или submit.','Commands: run or submit.'));
  }
  function resetRoute(){stop();setCompleted(0);setSelected(0);setPosition(nodes[0]);setDrafts({});setSeconds(0);setResult(null);setResultCheckpoint(null);setStatus('idle');setReset(false);setSummit(false);setOverview(false);}

  return <main className={`climb-app ${editorOpen?'with-editor':''} ${terminalExpanded?'terminal-expanded':''}`}>
    <header className="topbar">
      <a className="wordmark" href="#" onClick={e=>{e.preventDefault();setOverview(v=>!v);}}><Mountain size={26}/><span>CODE<span className="wordmark-light">CLIMB</span></span></a>
      <div className="top-center"><div className="language-switch" role="group" aria-label={t('Язык программирования','Programming language')}><button disabled={busy} aria-pressed={language==='python'} onClick={async()=>{if(await saveAccount())changeLanguage('python');}}>Python</button><button disabled={busy} aria-pressed={language==='cpp'} onClick={async()=>{if(await saveAccount())changeLanguage('cpp');}}>C++</button></div><span className="top-separator"/><span>THE ASCENT / 01</span></div>
      <div className="top-actions"><LanguageSwitcher/><button onClick={()=>setHelp(true)} aria-label={t('Как играть','How to play')}><HelpCircle size={19}/></button><button className="account-button" disabled={busy} onClick={async()=>{if(await saveAccount())window.location.assign('/compete');}}>{t('Соревнование','Competition')}</button>{user?.role==='admin'&&<button className="account-button" disabled={busy} onClick={async()=>{if(await saveAccount())window.location.assign('/admin');}}>{t('Админка','Admin')}</button>}<AccountButton disabled={busy} beforeChange={saveAccount}/><button className="profile-toggle" onClick={()=>setProfile(true)} aria-label={t('Выбрать аватар','Choose avatar')}><Avatar kind={avatar}/><span>{user?.username??'you'}</span></button></div>
    </header>

    <div className="difficulty-bar">
      <label htmlFor="difficulty">{t('Маршрут','Route')}</label>
      <select id="difficulty" value={difficulty} disabled={busy} onChange={async e=>{const next=e.target.value as Difficulty;if(difficulties.includes(next)&&await saveAccount())changeDifficulty(next);}}>
        {difficulties.map(d=><option key={d} value={d}>{difficultyName(d)}{d==='classic'||d==='full'?t(' · 15 уровней',' · 15 levels'):''}</option>)}
      </select>
      <span>{count} {t('задач','challenges')} · {difficulty==='full'?t('5 лёгких + 5 средних + 5 сложных','5 easy + 5 medium + 5 hard'):difficulty==='classic'?t('прежний прогресс сохранён','previous progress preserved'):t('свой маршрут и прогресс','separate route and progress')}</span>
    </div>
    <div className="play-layout">
      {editorOpen && <aside className="challenge-card brief" aria-label={t('Текущая задача','Current challenge')}>
          <div className="checkpoint-meta"><span>CHECKPOINT {String(selected+1).padStart(2,'0')}</span><span>{selected<completed?t('ПРОЙДЕН','CLEARED'):language==='python'?'PYTHON 3':'C++20'}</span></div>
          <h1>{displayChallenge.title}</h1><p className="topic">{displayChallenge.topic}</p>
          <p className="description">{displayChallenge.description}</p>
          <div className="example"><span>{t('ПРИМЕР','EXAMPLE')}</span><code>{challenge.fn}({challenge.tests[0].args.map(displayValue).join(', ')})</code><code className="expected">→ {displayValue(challenge.tests[0].expected)}</code></div>
          <div className="constraint">{displayChallenge.constraint}</div>
          <button className="hint-toggle" onClick={()=>setHint(v=>!v)}>{hint?t('− Скрыть подсказку','− Hide hint'):t('+ Подсказка','+ Hint')}</button>
          {hint&&<><p className="hint-text">{displayChallenge.hint}</p><RewardHint key={`${language}-${challenge.id}`} language={language} taskId={challenge.id}/></>}
      </aside>}
      {editorOpen && <aside className={`workbench terminal-window ${terminalExpanded?'expanded':''}`} aria-label={t(`Терминал ${label}`,`${label} terminal`)}>
        <div className="workbench-title"><span><Code2 size={17}/> TERMINAL <small>{t('КОД + ВЫВОД','CODE + OUTPUT')}</small></span><div className="terminal-title-actions"><button aria-label={terminalExpanded?t('Уменьшить терминал','Shrink terminal'):t('Увеличить терминал','Expand terminal')} onClick={()=>setTerminalExpanded(v=>!v)}>{terminalExpanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button aria-label={t('Свернуть редактор','Collapse editor')} onClick={()=>setEditorOpen(false)}><Minus size={18}/></button></div></div>
        <div className="terminal-main">
          <div className="terminal-code">
            <div className="file-tab"><span><i/> {language==='python'?'solution.py':'solution.cpp'}</span><span>Ctrl+Enter → SUBMIT</span></div>
            <div className="code-pane">{hydrated&&<PythonEditor language={language} value={code} disabled={busy} onChange={v=>setDrafts(p=>({...p,[selected]:v}))} onSubmit={()=>run(true)}/>}</div>
          </div>
          <div className="terminal-output">
            <div className={`console status-${status}`} aria-live="polite">
          <div className="console-heading"><span>CONSOLE{resultCheckpoint!==null&&` · CHECKPOINT ${String(resultCheckpoint).padStart(2,'0')}`}</span><span>{result?.ms!==undefined?`${result.ms} ms`:`${label.toUpperCase()} / SANDBOX`}</span></div>
          {lastCommand&&<p className="console-command"><b>›</b> {lastCommand}</p>}
          {status==='idle'&&<p><b>›</b> {t('Готов к запуску. Верни ответ из функции.','Ready to run. Return the answer from your function.')}</p>}
          {status==='loading'&&<p className="loading-text">{t('Подключение','Loading')} {label}… {language==='cpp'?t('При первом запуске загрузится около 30 МБ.','The first run downloads about 30 MB.'):t('Первый запуск займёт несколько секунд.','The first run may take a few seconds.')}</p>}
          {status==='compiling'&&<p className="loading-text">{t('Компиляция C++20…','Compiling C++20…')}</p>}
          {status==='running'&&<p className="loading-text">{t('Выполнение тестов…','Running tests…')}</p>}
          {commandError&&<pre>{commandError}</pre>}
          {result?.error&&<pre>{result.error}</pre>}
          {!!result?.results.length&&<><p>{result.results.filter(r=>r.passed).length} / {result.results.length} {t('тестов пройдено','tests passed')} {moving?t('· ПОДЪЁМ…','· CLIMBING…'):''}</p><div className="console-results">{result.results.map((r,i)=><div key={i} className={r.passed?'pass':'fail'}><strong>{r.passed?'✓':'×'} TEST {String(i+1).padStart(2,'0')}</strong><code>{t('Ответ','Actual')}: {r.actual}</code>{!r.passed&&<code>{t('Ожидалось','Expected')}: {r.expected}</code>}</div>)}</div></>}
          {result?.stdout&&<pre>{result.stdout}</pre>}
            </div>
            <form className="terminal-command-line" onSubmit={e=>{e.preventDefault();executeTerminalCommand();}}><label htmlFor="terminal-command">›</label><input id="terminal-command" value={terminalCommand} onChange={e=>setTerminalCommand(e.target.value)} disabled={busy} spellCheck={false} aria-label={t('Команда терминала: run или submit','Terminal command: run or submit')}/><button type="submit" disabled={busy} aria-label={t('Выполнить команду','Execute command')}><Send size={15}/></button></form>
          </div>
        </div>
        <div className="runbar"><button className="icon-button" disabled={busy} aria-label={t('Сбросить код','Reset code')} onClick={()=>setDrafts(p=>({...p,[selected]:starterCode(challenge)}))}><RotateCcw size={16}/></button>{status==='loading'||status==='compiling'||status==='running'?<button className="run-button" onClick={stop}><Square size={13}/> {t('СТОП','STOP')}</button>:<button className="run-button" onClick={()=>run(false)} disabled={busy}><Play size={14}/> RUN</button>}<button className="submit-button" onClick={()=>run(true)} disabled={busy}><Send size={14}/> SUBMIT <ChevronRight size={15}/></button></div>
        <div className="local-note">{t('Изолированный запуск · без сети и файлов компьютера','Isolated execution · no network or computer files')}</div>
        <div className="save-status" role="status">{saveStatus}</div>
      </aside>}

      <section className={`arena ${overview?'overview':''}`} aria-label={t('Карта восхождения','Ascent map')}>
        <svg className="cliff-world" viewBox={`0 ${cameraY} 1000 ${overview?1850:800}`} preserveAspectRatio={overview?'xMidYMid meet':'xMidYMid slice'} aria-label={t(`Маршрут из ${count} задач`,`${count}-challenge route`)}>
          <defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#032837" stopOpacity=".05"/><stop offset="1" stopColor="#001c30" stopOpacity=".55"/></linearGradient></defs>
          <image href="/cliff.png" x="0" y="0" width="1000" height="1850" preserveAspectRatio="xMidYMid slice"/>
          <rect width="1000" height="1850" fill="url(#shade)"/>
          {(difficulty==='classic'?[180,705,1230]:[180]).map((y,i)=><g key={y} className="round-boundary"><path d={`M-100 ${y+20} L140 ${y+10} L320 ${y+18} L520 ${y+5} L710 ${y+15} L1100 ${y}`} /><text x="70" y={y-6}>{difficulty==='classic'?`ROUND 0${3-i}`:difficultyName(difficulty).toUpperCase()}</text></g>)}
          <path d={route} className="route-underlay"/><path d={route} className="route-future"/>
          {completed>0&&<path d={nodes.slice(0,Math.min(completed+1,count)).map((n,i)=>i?`V${n.y}H${n.x}`:`M${n.x},${n.y}`).join(' ')} className="route-done"/>}
          {nodes.map((n,i)=><g key={n.id} className={`checkpoint ${i<completed?'cleared':i===completed?'active':'locked'}`} role="button" aria-label={t(`Уровень ${n.id}: ${displayTasks[i].title}${i>completed?', заблокирован':''}`,`Level ${n.id}: ${displayTasks[i].title}${i>completed?', locked':''}`)} aria-disabled={i>completed||busy} tabIndex={i<=completed?0:-1} onClick={()=>select(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}}}>
            <title>{`${n.id}. ${displayTasks[i].title}`}</title><rect x={n.x-23} y={n.y-23} width="46" height="46" fill="transparent"/><rect className="checkpoint-box" x={n.x-8} y={n.y-8} width="16" height="16"/>
            <text x={n.x+27} y={n.y+5} className="node-label">{String(n.id).padStart(2,'0')}</text>
            {i<completed&&<path d={`m${n.x-4},${n.y} 3,3 5,-6`} className="node-tick"/>}
          </g>)}
          <g className="you-marker" transform={`translate(${position.x-62},${position.y-19})`}><rect x="-7" y="-6" width="42" height="46" rx="3"/><foreignObject width="28" height="34"><Avatar kind={avatar}/></foreignObject><text x="14" y="-16" textAnchor="middle">YOU</text></g>
          <g transform="translate(555,154)" className="summit-flag"><path d="M0 0V-45H35L24-33l11 12H0"/><text x="0" y="-60" textAnchor="middle">SUMMIT</text></g>
          <text className="base-label" x="660" y="1740" textAnchor="middle">BASE CAMP</text>
        </svg>
        <div className="arena-shade"/>
        <div className="arena-top">
          <div className="round-info"><span className="eyebrow">{label.toUpperCase()} · {difficultyName(difficulty).toUpperCase()}</span><h2>{t('Раунд','Round')} <span>{String(round).padStart(2,'0')}</span></h2><div className="round-segments">{[0,1,2,3,4].map(i=><i key={i} className={i<completed%5||completed===count?'filled':''}/>)}</div><p>{t('Тренировка','Training')} <span>{t('· без рейтинга','· unranked')}</span></p></div>
          <button className="minimap" onClick={()=>setOverview(v=>!v)} title={overview?t('Вернуться к игроку','Return to player'):t('Показать всю гору','Show the whole mountain')} aria-label={overview?t('Вернуться к игроку','Return to player'):t('Показать всю гору','Show the whole mountain')}><Mountain/><span>{overview?t('К ИГРОКУ','TO PLAYER'):t('ОБЗОР ГОРЫ','MOUNTAIN VIEW')}</span></button>
        </div>
        <div className="arena-stats"><span><b>{altitude(completed).toLocaleString(uiLanguage==='en'?'en-US':'ru-RU')}</b> {t('м','m')}</span><i/><span>{completed}<small>/{count}</small><label>{t('ПРОЙДЕНО','CLEARED')}</label></span><i/><span>{time}<label>{t('ВРЕМЯ','TIME')}</label></span></div>
        <div className="map-controls">{!editorOpen&&<button onClick={()=>setEditorOpen(true)} aria-label={t('Открыть редактор','Open editor')}><Code2 size={19}/></button>}<button onClick={()=>setOverview(false)} aria-label={t('Приблизить маршрут','Zoom in')} disabled={!overview}><Plus size={19}/></button><button onClick={()=>setOverview(true)} aria-label={t('Показать всю гору','Show the whole mountain')} disabled={overview}><Minus size={19}/></button><button onClick={()=>setEditorOpen(v=>!v)} aria-label={t('Развернуть карту','Expand map')}><Maximize2 size={17}/></button></div>
        <div className="stage-caption"><span>STAGE {String(Math.min(completed+1,count)).padStart(2,'0')} / {count}</span><strong>{completed===count?t('ВЕРШИНА ДОСТИГНУТА','SUMMIT REACHED'):displayTasks[Math.min(completed,count-1)].title}</strong><button onClick={()=>select(Math.min(completed,count-1))} disabled={busy}>{completed===count?t('Повторить задачу','Replay challenge'):t('Открыть задачу','Open challenge')} <ChevronRight size={16}/></button></div>
        {moving&&<div className="clear-message" role="status"><Flag size={24}/><span>{t('ЭТАП ПРОЙДЕН','CHECKPOINT CLEARED')}</span><small>{t('Следующая высота…','Next altitude…')}</small></div>}
        <div className="map-bottom"><span>{user?t('ПРОГРЕСС СОХРАНЯЕТСЯ','PROGRESS SAVED'):t('ГОСТЕВОЙ РЕЖИМ','GUEST MODE')}</span><span>{t('БЕЛЫЙ — МАРШРУТ','WHITE — ROUTE')} <i className="key-yellow"/> {t('ТЫ','YOU')}</span></div>
      </section>

      <aside className="standings" aria-label={t('Тренировочный прогресс','Training progress')}><div className="standings-head"><Trophy size={17}/><span>TRAINING</span><small>{t('СОЛО','SOLO')}</small></div><div className="your-rank"><span>{t('ТВОЙ ПРОГРЕСС','YOUR PROGRESS')}</span><strong>{String(completed).padStart(2,'0')}<small>/{count}</small></strong></div><ol><li className="is-you"><span className="rank-no">01</span><Avatar kind={avatar}/><span className="racer"><b>{user?.username??'you'}</b><small>{label} · {difficultyName(difficulty)}</small></span><span className="racer-altitude">{altitude(completed).toLocaleString(uiLanguage==='en'?'en-US':'ru-RU')}<small> {t('м','m')}</small></span></li></ol><div className="summit-distance"><Flag size={19}/><span>{t('ДО ВЕРШИНЫ','TO SUMMIT')}<b>{(8848-altitude(completed)).toLocaleString(uiLanguage==='en'?'en-US':'ru-RU')} {t('м','m')}</b></span></div><p className="race-note">{t('Тренировка разрешает вставку кода и подсказки. Для честной дуэли открой режим соревнования.','Training allows paste and hints. Open competition mode for a fair duel.')}</p><button className="restart-link" onClick={async()=>{if(await saveAccount())window.location.assign('/compete');}} disabled={busy}><Trophy size={13}/> {t('Соревнование','Competition')}</button><button className="restart-link" onClick={()=>setReset(true)} disabled={busy}><RotateCcw size={13}/> {t('Начать заново','Start over')}</button></aside>
    </div>

    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="small-dialog"><DialogTitle>{t('Как подняться на вершину','How to reach the summit')}</DialogTitle><DialogDescription>{t('Выбери язык и сложность. В каждом новом наборе пять разных задач. Старый маршрут доступен отдельно; прогресс всех наборов независим.','Choose a language and difficulty. Each new set has five different challenges. The classic route is separate; progress is independent for each route.')}</DialogDescription><ol className="help-steps"><li>{t('Нажми на текущий квадрат маршрута и прочитай задачу.','Select the current checkpoint and read the challenge.')}</li><li>{t('Напиши функцию любым подходящим способом. RUN запускает два примера. В C++ функция main не нужна.','Write a function in any valid way. RUN checks two examples. C++ does not need a main function.')}</li><li>{t('SUBMIT проверяет все пять тестов. Верное решение поднимает твой аватар.','SUBMIT checks all five tests. A correct solution moves your avatar higher.')}</li><li>{t('В коде Enter создаёт новую строку. В строке терминала Enter выполняет run или submit; Ctrl+Enter в редакторе отправляет решение.','Enter adds a new line in the editor. In the terminal command line, Enter runs run or submit; Ctrl+Enter in the editor submits your solution.')}</li></ol><p>{t('Войди, чтобы сохранять решения в аккаунте. Без аккаунта прогресс остаётся в этом браузере; гостевые решения автоматически в аккаунт не переносятся.','Sign in to save solutions to your account. Without an account, progress stays in this browser; guest solutions are not automatically imported.')}</p><p>{t('Тренировка выполняется в браузерной песочнице без сети и файлов компьютера. Защищённая серверная проверка и запрет вставки включаются в режиме соревнования.','Training runs in a browser sandbox without access to the network or your files. Competition uses server-side checking and disables pasting.')}</p><button className="submit-button" onClick={()=>setHelp(false)}>{t('Понятно','Got it')}</button></DialogContent></Dialog>
    <Dialog open={profile} onOpenChange={setProfile}><DialogContent className="small-dialog"><DialogTitle>{t('Твой аватар','Your avatar')}</DialogTitle><DialogDescription>{t('Выбери значок, по которому узнаешь себя на скале.','Choose the icon that marks you on the mountain.')}</DialogDescription><div className="avatar-picker">{[0,1,2,3].map(n=><button key={n} onClick={()=>{setAvatar(n);setProfile(false);}} className={avatar===n?'chosen':''} aria-label={t(`Аватар ${n+1}`,`Avatar ${n+1}`)} aria-pressed={avatar===n}><Avatar kind={n}/></button>)}</div></DialogContent></Dialog>
    <Dialog open={reset} onOpenChange={setReset}><DialogContent className="small-dialog"><DialogTitle>{t('Начать восхождение заново?','Start the ascent again?')}</DialogTitle><DialogDescription>{t('Прогресс','Progress')} {label} · {difficultyName(difficulty)} {t('и решения будут удалены','and solutions will be deleted')} {user?t('из текущего аккаунта','from this account'):t('из этого браузера','from this browser')}. {t('Другие языки и уровни сложности не изменятся.','Other languages and difficulty routes will remain unchanged.')}</DialogDescription><div className="dialog-actions"><button className="run-button" onClick={()=>setReset(false)}>{t('Отмена','Cancel')}</button><button className="submit-button" onClick={resetRoute}>{t('Начать заново','Start over')}</button></div></DialogContent></Dialog>
    <Dialog open={summit} onOpenChange={setSummit}><DialogContent className="small-dialog summit-dialog"><Flag size={48}/><DialogTitle>{t('ВЕРШИНА ДОСТИГНУТА','SUMMIT REACHED')}</DialogTitle><DialogDescription>8,848 {t('м','m')} · {label.toUpperCase()} CLIMB COMPLETED</DialogDescription><p>{t('Все','All')} {count} {t('задач пройдены.','challenges cleared.')}<br/>{t('Время восхождения:','Ascent time:')} {time}</p><button className="submit-button" onClick={()=>{setSummit(false);setOverview(true);}}>{t('Посмотреть маршрут','View route')}</button></DialogContent></Dialog>
  </main>;
}
