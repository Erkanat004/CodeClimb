'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Database,ArrowRightLeft,ShieldCheck,RefreshCw,CheckCircle2,AlertTriangle} from 'lucide-react';
import {accountRequest} from './account';
import {useLanguage} from '@/lib/i18n';

type Job={id:string;state:'running'|'completed'|'failed';stage:string;error:string|null;counts:Record<string,number>|null;restartRequired:boolean};
type DatabaseStatus={driver:'sqlite'|'postgres';canActivate:boolean;job:Job|null};

export function AdminDatabase(){
  const {t}=useLanguage();
  const [status,setStatus]=useState<DatabaseStatus|null>(null),[url,setUrl]=useState(''),[confirmed,setConfirmed]=useState('');
  const [tested,setTested]=useState(''),[testInfo,setTestInfo]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useRef(true);
  async function refresh(){const data=await accountRequest('admin/database');if(active.current)setStatus(data as unknown as DatabaseStatus);}
  useEffect(()=>{active.current=true;void refresh().catch(()=>{});return()=>{active.current=false;};},[]);
  useEffect(()=>{if(status?.job?.state!=='running')return;const timer=setInterval(()=>void refresh().catch(()=>{}),1500);return()=>clearInterval(timer);},[status?.job?.state]);
  async function test(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setTestInfo('');setTested('');
    try{const data=await accountRequest('admin/database/test','POST',{url});setTested(url);setTestInfo(String(data.database)+' · '+String(data.version));}
    catch(e){setError(e instanceof Error?e.message:t('Соединение не удалось.','Connection failed.'));}
    finally{setBusy(false);}
  }
  async function migrate(){
    if(busy||tested!==url||confirmed!=='MIGRATE')return;
    setBusy(true);setError('');
    try{await accountRequest('admin/database/migrate','POST',{url,confirm:confirmed});setUrl('');setTested('');setConfirmed('');await refresh();}
    catch(e){setError(e instanceof Error?e.message:t('Не удалось начать перенос.','Could not start migration.'));}
    finally{setBusy(false);}
  }
  const job=status?.job;
  const stageLabel:Record<string,string>={waiting:t('Ожидание запросов','Waiting for requests'),snapshot:t('Снимок SQLite','SQLite snapshot'),import:t('Импорт данных','Importing data'),activation:t('Сохранение настроек','Saving configuration'),complete:t('Завершено','Complete')};
  const jobError=job?.error?.startsWith('Data imported but activation failed.')?t('Данные перенесены, но активировать PostgreSQL не удалось. Запись в SQLite остановлена. Сохраните обе БД и перезапустите API для возврата к SQLite.','Data imported but activation failed. SQLite remains paused. Keep both databases and restart the API to resume SQLite.'):job?.error==='Finish active duels before database migration.'?t('Завершите активные дуэли перед переносом.','Finish active duels before migration.'):job?.error==='Target PostgreSQL database is not empty.'?t('Целевая PostgreSQL не пуста. Нужна отдельная пустая база.','Target PostgreSQL database is not empty. Use a separate empty database.'):job?.error;
  return <section className="admin-db" aria-labelledby="admin-db-title">
    <div className="admin-card-heading"><div className="admin-card-icon"><Database size={22}/></div><div><span className="admin-eyebrow">{t('ХРАНИЛИЩЕ','STORAGE')}</span><h2 id="admin-db-title">{t('База данных','Database')}</h2><p>{t('SQLite для простого старта. PostgreSQL — для сетевой нагрузки.','SQLite for a simple start. PostgreSQL for networked workloads.')}</p></div></div>
    <div className="admin-db-status"><div><small>{t('СЕЙЧАС АКТИВНА','ACTIVE NOW')}</small><strong>{status?.driver==='postgres'?'PostgreSQL':'SQLite'}</strong></div><ArrowRightLeft size={22}/><div><small>{t('ВОЗМОЖНЫЙ ПЕРЕХОД','AVAILABLE UPGRADE')}</small><strong>PostgreSQL</strong></div><span className="admin-pill"><ShieldCheck size={14}/>{t('Данные под контролем','Data protected')}</span></div>
    {status?.driver==='postgres'?<p className="admin-db-note"><CheckCircle2 size={18}/>{t('PostgreSQL подключён. Параметры соединения и пароль не отображаются в админке.','PostgreSQL is active. Connection credentials are never shown in the admin panel.')}</p>:<>
      <p className="admin-db-note"><AlertTriangle size={18}/>{t('Перед переносом завершите активные дуэли и сделайте резервную копию SQLite. Во время переноса игра будет недоступна; после него перезапустите API. Старую SQLite не удаляйте.','Finish active duels and back up SQLite first. The game is unavailable during migration; restart the API afterward. Keep the old SQLite database.')}</p>
      {!status?.canActivate&&<p className="auth-error">{t('Для активации через админку сначала задайте на сервере DB_CONFIG_KEY длиной от 32 случайных символов.','Set a random DB_CONFIG_KEY of at least 32 characters on the server before activating from the admin panel.')}</p>}
      {(!job||job.state==='failed')&&<form className="admin-db-form" onSubmit={test}>
        <label htmlFor="admin-db-url">{t('Строка подключения PostgreSQL','PostgreSQL connection URL')}</label>
        <input id="admin-db-url" type="password" autoComplete="off" spellCheck={false} value={url} onChange={event=>{setUrl(event.target.value);setTested('');setTestInfo('');}} placeholder="postgresql://user:password@host:5432/codeclimb" required maxLength={2048}/>
        <p className="field-note">{t('Адрес передаётся только серверу для проверки и переноса. После успешного переноса он сохраняется зашифрованным; пароль не возвращается в браузер.','The URL is sent only to the server for testing and migration. After success it is stored encrypted; the password is never returned to the browser.')}</p>
        <div className="admin-db-actions"><button className="run-button" type="submit" disabled={busy||!url}><RefreshCw size={15}/>{t('Проверить соединение','Test connection')}</button>{testInfo&&<span className="admin-db-success"><CheckCircle2 size={15}/>{testInfo}</span>}</div>
        {tested===url&&status?.canActivate&&<div className="admin-db-confirm"><label htmlFor="admin-db-confirm">{t('Для переноса введи MIGRATE','Type MIGRATE to confirm')}</label><input id="admin-db-confirm" value={confirmed} onChange={event=>setConfirmed(event.target.value)} autoComplete="off" placeholder="MIGRATE"/><button type="button" className="submit-button" disabled={busy||confirmed!=='MIGRATE'} onClick={()=>void migrate()}>{t('Перенести данные в PostgreSQL','Migrate data to PostgreSQL')}</button></div>}
      </form>}
    </>}
    {job&&<div className={`admin-db-job ${job.state}`} role="status"><strong>{job.state==='running'?t('Перенос выполняется','Migration in progress'):job.state==='completed'?t('Данные перенесены','Data migrated'):t('Перенос остановлен','Migration stopped')}</strong><span>{job.state==='running'?t('Этап: ','Stage: ')+(stageLabel[job.stage]??job.stage):job.state==='completed'?t('Перезапусти API для перехода на PostgreSQL. До перезапуска запись в SQLite остановлена.','Restart the API to switch to PostgreSQL. SQLite writes remain paused until then.'):jobError}</span>{job.counts&&<small>{t('Игроков: ','Players: ')}{job.counts.users} · {t('Записей прогресса: ','Progress records: ')}{job.counts.progress+job.counts.course_progress+job.counts.full_progress}</small>}</div>}
    {error&&<p className="auth-error" role="alert">{error}</p>}
  </section>;
}
