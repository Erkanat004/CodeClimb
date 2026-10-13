'use client';
import {useRef,useState,type FormEvent} from 'react';
import {accountRequest} from './account';
import {useLanguage} from '@/lib/i18n';
export function PasswordForm({beforeChange}:{beforeChange:()=>Promise<boolean>}){
  const {t}=useLanguage();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const sending=useRef(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(sending.current)return;
    const form=event.currentTarget,data=new FormData(form);
    if(data.get('newPassword')!==data.get('confirm')){setError(t('Новые пароли не совпадают.','New passwords do not match.'));return;}
    sending.current=true;setBusy(true);setError('');setMessage('');
    try{
      if(!await beforeChange())throw Error(t('Дождись сохранения прогресса и повтори.','Wait for your progress to save, then try again.'));
      await accountRequest('password','POST',{currentPassword:data.get('currentPassword'),newPassword:data.get('newPassword')});
      form.reset();setOpen(false);setMessage(t('Пароль изменён. Остальные сессии завершены.','Password changed. Other sessions were signed out.'));
    }catch(e){setError(e instanceof Error?e.message:t('Не удалось изменить пароль.','Could not change the password.'));}
    finally{sending.current=false;setBusy(false);}
  }
  return <section className="password-section"><button className="auth-switch" type="button" disabled={busy} onClick={()=>{setOpen(v=>!v);setError('');}}>{open?t('Скрыть смену пароля','Hide password form'):t('Сменить пароль','Change password')}</button>
    {open&&<form className="account-form" onSubmit={submit}>
      <label>{t('Текущий пароль','Current password')}<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} required disabled={busy}/></label>
      <label>{t('Новый пароль','New password')}<input type="password" name="newPassword" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label>
      <label>{t('Повтори новый пароль','Repeat new password')}<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label>
      <p className="field-note">{t('12–128 символов. На других устройствах потребуется войти заново. Вставка и менеджеры паролей разрешены.','12–128 characters. You will need to sign in again on other devices. Paste and password managers are allowed.')}</p>
      <button className="submit-button" disabled={busy}>{busy?t('Сохраняем…','Saving…'):t('Изменить пароль','Change password')}</button>
    </form>}
    {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p role="status" className="success-note">{message}</p>}
  </section>;
}
