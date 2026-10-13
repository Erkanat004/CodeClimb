'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {accountRequest} from './account';
import {useLanguage} from '@/lib/i18n';
type Settings={provider:'off'|'test'|'applixir';publicKey:string;gameId:string;maxPerRound:number;adsTxt:string};
export function AdminAds(){
  const {t}=useLanguage();
  const [settings,setSettings]=useState<Settings|null>(null),[stats,setStats]=useState({attempts:0,granted:0}),[testAllowed,setTestAllowed]=useState(false),[webhook,setWebhook]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;accountRequest('admin/ads').then(p=>{if(active){setSettings(p.settings as Settings);setStats(p.stats as typeof stats);setTestAllowed(Boolean(p.testAllowed));setWebhook(Boolean(p.webhookReady));}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{await accountRequest('admin/ads','PUT',settings);setMessage(t('Настройки сохранены. Изменения действуют для новых просмотров.','Settings saved. Changes apply to new ad views.'));}catch(e){setError(e instanceof Error?e.message:t('Не удалось сохранить.','Could not save settings.'));}finally{setBusy(false);}}
  return <section className="admin-settings"><h2>{t('Реклама и подсказки','Ads and hints')}</h2><p>{t('Только в тренировке. Короткая наводка бесплатна; 1 подтверждённый просмотр открывает 1 подробную подсказку. Не более 3 за раунд.','Training only. A short hint is free; one verified ad view unlocks one detailed hint. No more than three per round.')}</p>
    {settings?<form className="account-form" onSubmit={save}>
      <label>{t('Режим','Mode')}<select value={settings.provider} disabled={busy} onChange={e=>setSettings({...settings,provider:e.target.value as Settings['provider']})}><option value="off">{t('Выключено','Off')}</option><option value="applixir">AppLixir · {t('серверное подтверждение','server verification')}</option>{testAllowed&&<option value="test">{t('Локальный тест · только администратор','Local test · admin only')}</option>}</select></label>
      <label>{t('Публичный API key сайта AppLixir','Public AppLixir site API key')}<input value={settings.publicKey} disabled={busy} maxLength={160} onChange={e=>setSettings({...settings,publicKey:e.target.value})}/></label>
      <label>{t('Game ID для проверки уведомлений','Game ID for callback verification')}<input value={settings.gameId} disabled={busy} maxLength={100} onChange={e=>setSettings({...settings,gameId:e.target.value})}/></label>
      <label>{t('Подсказок за раунд','Hints per round')}<select value={settings.maxPerRound} disabled={busy} onChange={e=>setSettings({...settings,maxPerRound:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label>{t('Строки ads.txt от рекламного сервиса','ads.txt lines from the ad provider')}<textarea rows={4} value={settings.adsTxt} disabled={busy} maxLength={10000} onChange={e=>setSettings({...settings,adsTxt:e.target.value})}/></label>
      <p className="field-note">{t('Секрет уведомлений:','Callback secret:')} {webhook?t('настроен на сервере','configured on server'):t('не настроен','not configured')}. {t('Секрет не вводится здесь. Адрес callback: /api/account/rewards/applixir, режим MD5 and TID. До запуска нужны одобрение домена и проверка реального просмотра.','The secret is not entered here. Callback: /api/account/rewards/applixir, MD5 and TID mode. Domain approval and a real-view test are required before launch.')}</p>
      <button className="submit-button" disabled={busy}>{busy?t('Сохраняем…','Saving…'):t('Сохранить рекламу','Save ad settings')}</button>
    </form>:<p>{t('Загрузка настроек…','Loading settings…')}</p>}
    <p className="field-note">{t('Начато просмотров:','Views started:')} {stats.attempts} · {t('выдано подсказок:','hints granted:')} {stats.granted}. {t('Включая локальные тесты; это не статистика дохода.','Includes local tests; these are not revenue figures.')}</p>
    {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="success-note" role="status">{message}</p>}
  </section>;
}
