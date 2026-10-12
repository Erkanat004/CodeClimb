'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {PasswordForm} from './password-form';
export type User={id:string;username:string;email:string|null;email_verified_at:number|null;role:'player'|'admin'};
type Delivery='email'|'local-test'|'unavailable';
type Account={user:User|null;ready:boolean;available:boolean;delivery:Delivery;setUser:(u:User|null)=>void};
const Context=createContext<Account>({user:null,ready:false,available:false,delivery:'unavailable',setUser:()=>{}});
export const useAccount=()=>useContext(Context);
export async function accountRequest(path:string,method='GET',data?:unknown){
  const response=await fetch('/api/account/'+path,{method,signal:AbortSignal.timeout(20000),credentials:'same-origin',headers:{'Content-Type':'application/json','X-Code-Climb':'1'},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  const parsed=await response.json().catch(()=>({error:'Сервер аккаунтов недоступен. Проверь подключение и повтори позже.'})) as Record<string,unknown>;
  if(!response.ok)throw Object.assign(new Error(String(parsed.error??'Ошибка сервера')),{status:response.status});
  return parsed;
}
export function AccountProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[available,setAvailable]=useState(true),[delivery,setDelivery]=useState<Delivery>('unavailable');
  useEffect(()=>{let active=true;accountRequest('me').then(p=>{if(active){setUser(p.user as User|null);setDelivery((p.registration as {delivery:Delivery}).delivery);}}).catch(()=>{if(active)setAvailable(false);}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  return <Context.Provider value={{user,ready,available,delivery,setUser}}>{children}</Context.Provider>;
}
type Pending={id:string;email:string;delivery:Delivery;resendAt:number};
export function AccountButton({disabled,beforeChange}:{disabled:boolean;beforeChange:()=>Promise<boolean>}){
  const {user,setUser,available,delivery}=useAccount();
  const [open,setOpen]=useState(false),[register,setRegister]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [verification,setVerification]=useState<Pending|null>(null),[seconds,setSeconds]=useState(0);
  const busy=useRef(false);
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(!active)return;try{const v=JSON.parse(sessionStorage.getItem('climb-registration')||'null');if(v&&/^[a-f0-9]{64}$/.test(v.id)&&typeof v.email==='string'){setVerification(v);setRegister(true);}}catch{}});return()=>{active=false;};},[]);
  useEffect(()=>{if(!verification)return;const tick=()=>setSeconds(Math.max(0,Math.ceil((verification.resendAt-Date.now())/1000)));tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[verification]);
  function remember(v:Pending|null){setVerification(v);try{if(v)sessionStorage.setItem('climb-registration',JSON.stringify(v));else sessionStorage.removeItem('climb-registration');}catch{}}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy.current)return;const form=new FormData(e.currentTarget);
    if(register&&!verification&&form.get('password')!==form.get('confirm')){setError('Пароли не совпадают.');return;}
    busy.current=true;setPending(true);setError('');
    try{
      if(register&&verification){
        const p=await accountRequest('verify-email','POST',{challengeId:verification.id,code:String(form.get('code')??'').trim()});
        setUser(p.user as User);remember(null);setOpen(false);
      }else if(register){
        const p=await accountRequest('register','POST',{username:form.get('username'),email:form.get('email'),password:form.get('password')});
        remember({id:String(p.challengeId),email:String(form.get('email')),delivery:p.delivery as Delivery,resendAt:Date.now()+60000});
      }else{
        const p=await accountRequest('login','POST',{username:form.get('username'),password:form.get('password')});
        setUser(p.user as User);remember(null);setOpen(false);
      }
    }catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие.');}finally{busy.current=false;setPending(false);}
  }
  async function resend(){
    if(busy.current||!verification||seconds)return;busy.current=true;setPending(true);setError('');
    try{await accountRequest('resend-code','POST',{challengeId:verification.id});remember({...verification,resendAt:Date.now()+60000});}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отправить код.');}finally{busy.current=false;setPending(false);}
  }
  async function logout(){
    if(busy.current)return;busy.current=true;setPending(true);setError('');
    try{if(!await beforeChange())throw Error('Прогресс ещё не сохранён. Повтори выход через несколько секунд.');await accountRequest('logout','POST');setUser(null);setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:'Не удалось выйти.');}finally{busy.current=false;setPending(false);}
  }
  return <><button className="account-button" disabled={disabled} onClick={()=>{setError('');setOpen(true);}}>{user?user.username:'Войти'}</button>
    <Dialog open={open} onOpenChange={v=>{if(!pending)setOpen(v);}}><DialogContent className="small-dialog account-dialog"><DialogTitle>{user?'Твой аккаунт':register?verification?'Подтверди email':'Создать аккаунт':'Вход в CODE CLIMB'}</DialogTitle>
      <DialogDescription>{user?'Прогресс сохраняется отдельно для каждого языка и маршрута.':register?'Регистрация завершается после подтверждения электронной почты.':'Введи логин и пароль своего аккаунта.'}</DialogDescription>
      {!available&&<p className="auth-error">Сервер аккаунтов недоступен. Для локальной игры запусти npm run local и обнови страницу.</p>}
      {user?<><p>Логин: {user.username}<br/>{user.email??(user.role==='admin'?'Администратор':'Аккаунт создан до подключения почты')}</p><PasswordForm beforeChange={beforeChange}/><button className="submit-button" disabled={pending} onClick={logout}>Выйти из аккаунта</button></>:<form onSubmit={submit} className="account-form">
        {register&&verification?<div className="verification-step">
          <p>{verification.delivery==='local-test'?'Тестовый код сохранён локально, письмо на email не отправлялось. Открой файл в data/mail-preview на компьютере сервера.':<>Код отправлен на <strong>{verification.email}</strong>. Проверь также папку «Спам».</>}</p>
          <label>Код из 6 цифр<input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" disabled={pending} autoFocus/></label>
          <p className="field-note">Действует 10 минут. После 5 неверных попыток потребуется новый код.</p>
          <button className="auth-switch" type="button" disabled={pending||seconds>0} onClick={resend}>{seconds?'Отправить снова через '+seconds+' с':'Отправить новый код'}</button>
        </div>:<>
          <label>Логин<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="climber" disabled={pending}/></label>
          {register&&<label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" disabled={pending}/></label>}
          <label>Пароль<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?12:1} maxLength={128} disabled={pending}/></label>
          {register&&<label>Повтори пароль<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending}/></label>}
          <p className="field-note">{register?'Логин: 3–24 латинских буквы, цифры или _. Пароль: от 12 символов.':'Регистр логина не важен. Пароль вводится точно как при создании аккаунта.'}</p>
          {register&&delivery!=='email'&&<p className="field-note">{delivery==='local-test'?'Локальный тест почты: письмо будет сохранено в data/mail-preview, не отправлено наружу.':'Почта пока не подключена. Регистрация станет доступна после настройки отправки.'}</p>}
        </>}
        <button className="submit-button" disabled={pending||!available||(register&&!verification&&delivery==='unavailable')} type="submit">{pending?'Подожди…':register?verification?'Подтвердить и войти':'Получить код':'Войти'}</button>
        <button className="auth-switch" type="button" disabled={pending} onClick={()=>{setRegister(v=>!v);setError('');}}>{register?'Уже есть аккаунт? Войти':verification?'Продолжить подтверждение почты':'Нет аккаунта? Регистрация'}</button>
        {register&&verification&&<button type="button" className="auth-switch" disabled={pending} onClick={()=>{remember(null);setError('');}}>Начать регистрацию заново</button>}
      </form>}
      {error&&<p role="alert" className="auth-error">{error}</p>}
    </DialogContent></Dialog></>;
}
