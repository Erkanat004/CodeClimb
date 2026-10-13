'use client';
import {useEffect,useRef,useState} from 'react';
import {accountRequest,useAccount} from './account';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {useLanguage} from '@/lib/i18n';
import {englishDetailedHint} from '@/lib/detailed-hint-translations';
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
  const {language:uiLanguage,t}=useLanguage();
  const {user}=useAccount(),[state,setState]=useState<HintState|null>(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState<{id:string;provider:string;publicKey:string}|null>(null),[dialogOpen,setDialogOpen]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const active=useRef(true),sending=useRef(false),completedAttempt=useRef('');
  const path='hints/'+language+'/'+taskId;
  async function refresh(){const data=await accountRequest(path);if(active.current)setState(data as unknown as HintState);}
  useEffect(()=>{active.current=true;if(user)void refresh().catch(()=>{});return()=>{active.current=false;};},[user?.id,path]);
  async function cancel(id:string){await accountRequest('rewards/'+id+'/cancel','POST',{}).catch(()=>{});}
  async function begin(){
    if(sending.current)return;sending.current=true;setBusy(true);setError('');setStatus('');
    completedAttempt.current='';
    try{const p=await accountRequest(path,'POST',{});setStatus(p.provider==='test'?t('Локальный тест, без рекламы и дохода.','Local test, with no ad or revenue.'):t('Загрузка рекламы. Подсказка появится после подтверждения сервисом.','Loading ad. The hint appears after provider verification.'));setAttempt(p as unknown as {id:string;provider:string;publicKey:string});setDialogOpen(true);}
    catch(e){setError(e instanceof Error?e.message:t('Не удалось открыть рекламу.','Could not open the ad.'));setBusy(false);sending.current=false;}
  }
  function close(){
    if(!attempt)return;
    setDialogOpen(false);
    if(completedAttempt.current!==attempt.id){void cancel(attempt.id);setAttempt(null);setBusy(false);sending.current=false;}
    else setStatus(t('Просмотр завершён. Ждём подтверждение от рекламного сервиса.','View completed. Waiting for ad-provider verification.'));
  }
  useEffect(()=>{
    if(!attempt)return;
    let alive=true,launched=false,checking=false;
    async function failed(){
      if(completedAttempt.current===attempt!.id)return;
      await cancel(attempt!.id);if(alive){setError(t('Просмотр не завершён или реклама недоступна. Лимит не потрачен.','View incomplete or ad unavailable. Your limit was not used.'));setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;}
    }
    if(attempt.provider==='applixir')void loadSDK().then(()=>{if(!alive)return;launched=true;window.initializeAndOpenPlayer!({apiKey:attempt.publicKey,userId:attempt.id,injectionElementId:'climb-ad-player',adStatusCallbackFn:s=>{
      if(!alive)return;
      if(s.type==='complete'){completedAttempt.current=attempt.id;setStatus(t('Ожидаем серверное подтверждение награды…','Waiting for server reward verification…'));}
      else if(['skipped','manuallyEnded','consentDeclined'].includes(s.type))void failed();
      else if(s.type==='allAdsCompleted')setStatus(t('Проверяем подтверждение. Если рекламы не было, можно закрыть окно без расхода лимита.','Checking verification. If no ad played, you can close this window without using your limit.'));
    },adErrorCallbackFn:()=>{void failed();}});}).catch(()=>void failed());
    const timer=setInterval(async()=>{
      if(checking)return;checking=true;
      try{
        const p=await accountRequest('rewards/'+attempt.id);
        if(!alive)return;
        if(p.status==='granted'){await refresh();if(alive){setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;setStatus(t('Подробная подсказка открыта.','Detailed hint unlocked.'));}}
        else if(['expired','cancelled'].includes(String(p.status))){setAttempt(null);setDialogOpen(false);setBusy(false);sending.current=false;setError(t('Просмотр истёк или отменён. Лимит не потрачен.','The view expired or was cancelled. Your limit was not used.'));}
      }catch{if(alive)setStatus(t('Нет связи с сервером. Подтверждённая награда сохранится в аккаунте.','Server connection lost. Any verified reward will remain on your account.'));}
      finally{checking=false;}
    },2000);
    return()=>{alive=false;clearInterval(timer);if(!launched&&attempt.provider!=='test')void cancel(attempt.id);};
  },[attempt?.id]);
  if(!user)return <p className="field-note">{t('Для подробных подсказок войди в аккаунт. Короткая наводка выше бесплатна.','Sign in for detailed hints. The short hint above is free.')}</p>;
  return <div className="reward-hint">
    {state?.unlocked?<div className="detailed-hint"><strong>{t('План решения','Solution plan')}</strong><p>{uiLanguage==='en'?englishDetailedHint(language,taskId)??state.text:state.text}</p></div>:state?.provider==='off'?<p className="field-note">{t('Подробные подсказки за рекламу пока не подключены.','Detailed ad-supported hints are not available yet.')}</p>:<button className="hint-toggle" disabled={busy||!state||state.remaining===0} onClick={()=>void begin()}>{state?.provider==='test'?t('Тест награды (только администратор)','Test reward (admin only)'):t('Посмотреть рекламу — получить 1 подсказку','Watch an ad — get one hint')} · {t('осталось','remaining')} {state?.remaining??'…'}/{state?.limit??3}</button>}
    {attempt&&!dialogOpen&&<p role="status" className="field-note">{status}</p>}
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <Dialog open={Boolean(attempt)&&dialogOpen} onOpenChange={v=>{if(!v)close();}}>
      <DialogContent className="ad-dialog"><DialogTitle>{attempt?.provider==='test'?t('Тест подсказки','Test hint'):t('Одна реклама — одна подсказка','One ad — one hint')}</DialogTitle><DialogDescription>{t('Просмотр добровольный. Закрытие не мешает игре. Подсказку выдаёт сервер после подтверждения.','Watching is voluntary. Closing does not block the game. The server grants a hint after verification.')}</DialogDescription>
        <div id="climb-ad-player"/><p role="status">{status}</p>
        {attempt?.provider==='test'&&<button className="submit-button" onClick={()=>void accountRequest('rewards/'+attempt.id+'/test','POST',{}).catch(e=>setError(String(e.message)))}>{t('Выдать тестовую награду','Grant test reward')}</button>}
        <button className="run-button" onClick={close}>{t('Закрыть','Close')}</button>
      </DialogContent>
    </Dialog>
  </div>;
}
