'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {accountRequest} from './account';
type Settings={provider:'off'|'test'|'applixir';publicKey:string;gameId:string;maxPerRound:number;adsTxt:string};
export function AdminAds(){
  const [settings,setSettings]=useState<Settings|null>(null),[stats,setStats]=useState({attempts:0,granted:0}),[testAllowed,setTestAllowed]=useState(false),[webhook,setWebhook]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;accountRequest('admin/ads').then(p=>{if(active){setSettings(p.settings as Settings);setStats(p.stats as typeof stats);setTestAllowed(Boolean(p.testAllowed));setWebhook(Boolean(p.webhookReady));}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{await accountRequest('admin/ads','PUT',settings);setMessage('Настройки сохранены. Изменения действуют для новых просмотров.');}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить.');}finally{setBusy(false);}}
  return <section className="admin-settings"><h2>Реклама и подсказки</h2><p>Только в тренировке. Короткая наводка бесплатна; 1 подтверждённый просмотр открывает 1 подробную подсказку. Не более 3 за раунд.</p>
    {settings?<form className="account-form" onSubmit={save}>
      <label>Режим<select value={settings.provider} disabled={busy} onChange={e=>setSettings({...settings,provider:e.target.value as Settings['provider']})}><option value="off">Выключено</option><option value="applixir">AppLixir · серверное подтверждение</option>{testAllowed&&<option value="test">Локальный тест · только администратор</option>}</select></label>
      <label>Публичный API key сайта AppLixir<input value={settings.publicKey} disabled={busy} maxLength={160} onChange={e=>setSettings({...settings,publicKey:e.target.value})}/></label>
      <label>Game ID для проверки уведомлений<input value={settings.gameId} disabled={busy} maxLength={100} onChange={e=>setSettings({...settings,gameId:e.target.value})}/></label>
      <label>Подсказок за раунд<select value={settings.maxPerRound} disabled={busy} onChange={e=>setSettings({...settings,maxPerRound:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label>Строки ads.txt от рекламного сервиса<textarea rows={4} value={settings.adsTxt} disabled={busy} maxLength={10000} onChange={e=>setSettings({...settings,adsTxt:e.target.value})}/></label>
      <p className="field-note">Секрет уведомлений: {webhook?'настроен на сервере':'не настроен'}. Секрет не вводится здесь. Адрес callback: /api/account/rewards/applixir, режим MD5 and TID. До запуска нужны одобрение домена и проверка реального просмотра.</p>
      <button className="submit-button" disabled={busy}>{busy?'Сохраняем…':'Сохранить рекламу'}</button>
    </form>:<p>Загрузка настроек…</p>}
    <p className="field-note">Начато просмотров: {stats.attempts} · выдано подсказок: {stats.granted}. Включая локальные тесты; это не статистика дохода.</p>
    {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="success-note" role="status">{message}</p>}
  </section>;
}
