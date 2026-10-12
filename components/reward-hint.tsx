'use client';
import {useEffect,useRef,useState} from 'react';
import {accountRequest,useAccount} from './account';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
type HintState={unlocked:boolean;text:string|null;remaining:number;limit:number;provider:'off'|'test'|'applixir'};
type AdStatus={type:string};
declare global {interface Window {initializeAndOpenPlayer?:(options:{apiKey:string;userId:string;injectionElementId:string;adStatusCallbackFn:(status:AdStatus)=>void;adErrorCallbackFn:()=>void})=>void;}}
let sdk:Promise<void>|null=null;
function loadSDK(){
  if(window.initializeAndOpenPlayer)return Promise.resolve();
  if(sdk)return sdk;
  sdk=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.applixir.com/applixir.app.v6.1.0.js';script.async=true;script.referrerPolicy='no-referrer';
    const timeout=setTimeout(()=>{script.remove();sdk=null;reject(Error('Реклама не загрузилась. Лимит не потрачен.'));},15000);
    script.onload=()=>{clearTimeout(timeout);if(window.initializeAndOpenPlayer)resolve();else{sdk=null;reject(Error('Рекламный плеер недоступен.'));}};
    script.onerror=()=>{clearTimeout(timeout);script.remove();sdk=null;reject(Error('Реклама недоступна. Лимит не потрачен.'));};document.head.appendChild(script);
  });return sdk;
}
export function RewardHint({language,taskId}:{language:'python'|'cpp';taskId:number}){
  const {user}=useAccount(),[state,setState]=useState<HintState|null>(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState<{id:string;provider:string;publicKey:string}|null>(null),[dialogOpen,setDialogOpen]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const active=useRef(true),sending=useRef(false),completedAttempt=useRef('');
  const path='hints/'+language+'/'+taskId;
  async function refresh(){const data=await accountRequest(path);if(active.current)setState(data as unknown as HintState);}
  useEffect(()=>{active.current=true;if(user)void refresh().catch(()=>{});return()=>{active.current=false;};},[user?.id,path]);
  async function cancel(id:string){await accountRequest('rewards/'+id+'/cancel','POST',{}).catch(()=>{});}
  async function begin(){
    if(sending.current)return;sending.current=true;setBusy(true);setError('');setStatus('');
    completedAttempt.current='';
    try{const p=await accountRequest(path,'POST',{});setStatus(p.provider==='test'?'Локальный тест, без рекламы и дохода.':'Загрузка рекламы. Подсказка появится после подтверждения сервисом.');setAttempt(p as unknown as {id:string;provider:string;publicKey:string});setDialogOpen(true);}
    catch(e){setError(e instanceof Error?e.message:'Не удалось открыть рекламу.');setBusy(false);sending.current=false;}
  }
  function close(){
    if(!attempt)return;
    setDialogOpen(false);
    if(completedAttempt.current!==attempt.id){void cancel(attempt.id);setAttempt(null);setBusy(false);sending.current=false;}
    else setStatus('Просмотр завершён. Ждём подтверждение от рекламного сервиса.');
  }
  useEffect(()=>{
    if(!attempt)return;
    let alive=true,launched=false,checking=false;
    async function failed(){
      if(completedAttempt.current===attempt!.id)return;
      await cancel(attempt!.id);if(alive){setError('Просмотр не завершён или реклама недоступна. Лимит не потрачен.');setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;}
    }
    if(attempt.provider==='applixir')void loadSDK().then(()=>{if(!alive)return;launched=true;window.initializeAndOpenPlayer!({apiKey:attempt.publicKey,userId:attempt.id,injectionElementId:'climb-ad-player',adStatusCallbackFn:s=>{
      if(!alive)return;
      if(s.type==='complete'){completedAttempt.current=attempt.id;setStatus('Ожидаем серверное подтверждение награды…');}
      else if(['skipped','manuallyEnded','consentDeclined'].includes(s.type))void failed();
      else if(s.type==='allAdsCompleted')setStatus('Проверяем подтверждение. Если рекламы не было, можно закрыть окно без расхода лимита.');
    },adErrorCallbackFn:()=>{void failed();}});}).catch(()=>void failed());
    const timer=setInterval(async()=>{
      if(checking)return;checking=true;
      try{
        const p=await accountRequest('rewards/'+attempt.id);
        if(!alive)return;
        if(p.status==='granted'){await refresh();if(alive){setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;setStatus('Подробная подсказка открыта.');}}
        else if(['expired','cancelled'].includes(String(p.status))){setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;setError('Просмотр истёк или отменён. Лимит не потрачен.');}
      }catch{if(alive)setStatus('Нет связи с сервером. Подтверждённая награда сохранится в аккаунте.');}
      finally{checking=false;}
    },2000);
    return()=>{alive=false;clearInterval(timer);if(!launched&&attempt.provider!=='test')void cancel(attempt.id);};
  },[attempt?.id]);
  if(!user)return <p className="field-note">Для подробных подсказок войди в аккаунт. Короткая наводка выше бесплатна.</p>;
  return <div className="reward-hint">
    {state?.unlocked?<div className="detailed-hint"><strong>План решения</strong><p>{state.text}</p></div>:state?.provider==='off'?<p className="field-note">Подробные подсказки за рекламу пока не подключены.</p>:<button className="hint-toggle" disabled={busy||!state||state.remaining===0} onClick={()=>void begin()}>{state?.provider==='test'?'Тест награды (только администратор)':'Посмотреть рекламу — получить 1 подсказку'} · осталось {state?.remaining??'…'}/{state?.limit??3}</button>}
    {attempt&&!dialogOpen&&<p role="status" className="field-note">{status}</p>}
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <Dialog open={Boolean(attempt)&&dialogOpen} onOpenChange={v=>{if(!v)close();}}>
      <DialogContent className="ad-dialog"><DialogTitle>{attempt?.provider==='test'?'Тест подсказки':'Одна реклама — одна подсказка'}</DialogTitle><DialogDescription>Просмотр добровольный. Закрытие не мешает игре. Подсказку выдаёт сервер после подтверждения.</DialogDescription>
        <div id="climb-ad-player"/><p role="status">{status}</p>
        {attempt?.provider==='test'&&<button className="submit-button" onClick={()=>void accountRequest('rewards/'+attempt.id+'/test','POST',{}).catch(e=>setError(String(e.message)))}>Выдать тестовую награду</button>}
        <button className="run-button" onClick={close}>Закрыть</button>
      </DialogContent>
    </Dialog>
  </div>;
}
