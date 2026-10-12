'use client';
import {useRef,useState,type FormEvent} from 'react';
import {accountRequest} from './account';
export function PasswordForm({beforeChange}:{beforeChange:()=>Promise<boolean>}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const sending=useRef(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(sending.current)return;
    const form=event.currentTarget,data=new FormData(form);
    if(data.get('newPassword')!==data.get('confirm')){setError('Новые пароли не совпадают.');return;}
    sending.current=true;setBusy(true);setError('');setMessage('');
    try{
      if(!await beforeChange())throw Error('Дождись сохранения прогресса и повтори.');
      await accountRequest('password','POST',{currentPassword:data.get('currentPassword'),newPassword:data.get('newPassword')});
      form.reset();setOpen(false);setMessage('Пароль изменён. Остальные сессии завершены.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось изменить пароль.');}
    finally{sending.current=false;setBusy(false);}
  }
  return <section className="password-section"><button className="auth-switch" type="button" disabled={busy} onClick={()=>{setOpen(v=>!v);setError('');}}>{open?'Скрыть смену пароля':'Сменить пароль'}</button>
    {open&&<form className="account-form" onSubmit={submit}>
      <label>Текущий пароль<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} required disabled={busy}/></label>
      <label>Новый пароль<input type="password" name="newPassword" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label>
      <label>Повтори новый пароль<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label>
      <p className="field-note">12–128 символов. На других устройствах потребуется войти заново. Вставка и менеджеры паролей разрешены.</p>
      <button className="submit-button" disabled={busy}>{busy?'Сохраняем…':'Изменить пароль'}</button>
    </form>}
    {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p role="status" className="success-note">{message}</p>}
  </section>;
}
