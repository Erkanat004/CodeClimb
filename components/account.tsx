'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {PasswordForm} from './password-form';
import {LanguageProvider,useLanguage} from '@/lib/i18n';
export type User={id:string;username:string;email:string|null;email_verified_at:number|null;role:'player'|'admin'};
type Delivery='email'|'local-test'|'unavailable';
type Account={user:User|null;ready:boolean;available:boolean;delivery:Delivery;setUser:(u:User|null)=>void};
const Context=createContext<Account>({user:null,ready:false,available:false,delivery:'unavailable',setUser:()=>{}});
export const useAccount=()=>useContext(Context);
export async function accountRequest(path:string,method='GET',data?:unknown){
  const response=await fetch('/api/account/'+path,{method,signal:AbortSignal.timeout(20000),credentials:'same-origin',headers:{'Content-Type':'application/json','X-Code-Climb':'1'},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  const parsed=await response.json().catch(()=>({error:'Сервер аккаунтов недоступен. Проверь подключение и повтори позже.'})) as Record<string,unknown>;
  if(!response.ok){
    let message=String(parsed.error??'Ошибка сервера');
    try{if(localStorage.getItem('code-climb-ui-language')==='en'&&/[А-Яа-яЁё]/.test(message))message=({400:'Check the entered data and try again.',401:'Sign in or check your credentials.',403:'Access denied.',404:'Not found.',409:'This action conflicts with the current state. Refresh and try again.',429:'Too many attempts. Please wait before trying again.',503:'Service temporarily unavailable. Try again later.'} as Record<number,string>)[response.status]??'The request failed. Please try again.';}catch{}
    throw Object.assign(new Error(message),{status:response.status});
  }
  return parsed;
}
export function AccountProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[available,setAvailable]=useState(true),[delivery,setDelivery]=useState<Delivery>('unavailable');
  useEffect(()=>{let active=true;accountRequest('me').then(p=>{if(active){setUser(p.user as User|null);setDelivery((p.registration as {delivery:Delivery}).delivery);}}).catch(()=>{if(active)setAvailable(false);}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  return <LanguageProvider><Context.Provider value={{user,ready,available,delivery,setUser}}>{children}</Context.Provider></LanguageProvider>;
}
type Pending={id:string;email:string;delivery:Delivery;resendAt:number};
export function AccountButton({disabled,beforeChange}:{disabled:boolean;beforeChange:()=>Promise<boolean>}){
  const {user,setUser,available,delivery}=useAccount();
  const {t}=useLanguage();
  const [open,setOpen]=useState(false),[register,setRegister]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [verification,setVerification]=useState<Pending|null>(null),[seconds,setSeconds]=useState(0);
  const busy=useRef(false);
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(!active)return;try{const v=JSON.parse(sessionStorage.getItem('climb-registration')||'null');if(v&&/^[a-f0-9]{64}$/.test(v.id)&&typeof v.email==='string'){setVerification(v);setRegister(true);}}catch{}});return()=>{active=false;};},[]);
  useEffect(()=>{if(!verification)return;const tick=()=>setSeconds(Math.max(0,Math.ceil((verification.resendAt-Date.now())/1000)));tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[verification]);
  function remember(v:Pending|null){setVerification(v);try{if(v)sessionStorage.setItem('climb-registration',JSON.stringify(v));else sessionStorage.removeItem('climb-registration');}catch{}}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy.current)return;const form=new FormData(e.currentTarget);
    if(register&&!verification&&form.get('password')!==form.get('confirm')){setError(t('Пароли не совпадают.','Passwords do not match.'));return;}
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
    }catch(e){setError(e instanceof Error?e.message:t('Не удалось выполнить действие.','The action failed.'));}finally{busy.current=false;setPending(false);}
  }
  async function resend(){
    if(busy.current||!verification||seconds)return;busy.current=true;setPending(true);setError('');
    try{await accountRequest('resend-code','POST',{challengeId:verification.id});remember({...verification,resendAt:Date.now()+60000});}
    catch(e){setError(e instanceof Error?e.message:t('Не удалось отправить код.','Could not send the code.'));}finally{busy.current=false;setPending(false);}
  }
  async function logout(){
    if(busy.current)return;busy.current=true;setPending(true);setError('');
    try{if(!await beforeChange())throw Error(t('Прогресс ещё не сохранён. Повтори выход через несколько секунд.','Your progress is still saving. Try signing out again in a few seconds.'));await accountRequest('logout','POST');setUser(null);setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:t('Не удалось выйти.','Could not sign out.'));}finally{busy.current=false;setPending(false);}
  }
  return <><button className="account-button" disabled={disabled} onClick={()=>{setError('');setOpen(true);}}>{user?user.username:t('Войти','Sign in')}</button>
    <Dialog open={open} onOpenChange={v=>{if(!pending)setOpen(v);}}><DialogContent className="small-dialog account-dialog"><DialogTitle>{user?t('Твой аккаунт','Your account'):register?verification?t('Подтверди email','Verify email'):t('Создать аккаунт','Create account'):t('Вход в CODE CLIMB','Sign in to CODE CLIMB')}</DialogTitle>
      <DialogDescription>{user?t('Прогресс сохраняется отдельно для каждого языка и маршрута.','Progress is saved separately for each language and route.'):register?t('Регистрация завершается после подтверждения электронной почты.','Registration finishes after email verification.'):t('Введи логин и пароль своего аккаунта.','Enter your username and password.')}</DialogDescription>
      {!available&&<p className="auth-error">{t('Сервер аккаунтов недоступен. Для локальной игры запусти npm run local и обнови страницу.','The account server is unavailable. Try again later.')}</p>}
      {user?<><p>{t('Логин:','Username:')} {user.username}<br/>{user.email??(user.role==='admin'?t('Администратор','Administrator'):t('Аккаунт создан до подключения почты','Account created before email was enabled'))}</p><PasswordForm beforeChange={beforeChange}/><button className="submit-button" disabled={pending} onClick={logout}>{t('Выйти из аккаунта','Sign out')}</button></>:<form onSubmit={submit} className="account-form">
        {register&&verification?<div className="verification-step">
          <p>{verification.delivery==='local-test'?t('Тестовый код сохранён локально, письмо на email не отправлялось. Открой файл в data/mail-preview на компьютере сервера.','The test code was saved on the server; no email was sent. Open the file in data/mail-preview on the server.'):<>{t('Код отправлен на','A code was sent to')} <strong>{verification.email}</strong>. {t('Проверь также папку «Спам».','Check your spam folder too.')}</>}</p>
          <label>{t('Код из 6 цифр','6-digit code')}<input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" disabled={pending} autoFocus/></label>
          <p className="field-note">{t('Действует 10 минут. После 5 неверных попыток потребуется новый код.','Valid for 10 minutes. After five incorrect attempts, request a new code.')}</p>
          <button className="auth-switch" type="button" disabled={pending||seconds>0} onClick={resend}>{seconds?t('Отправить снова через ','Resend in ')+seconds+t(' с',' s'):t('Отправить новый код','Send a new code')}</button>
        </div>:<>
          <label>{t('Логин','Username')}<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="climber" disabled={pending}/></label>
          {register&&<label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" disabled={pending}/></label>}
          <label>{t('Пароль','Password')}<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?12:1} maxLength={128} disabled={pending}/></label>
          {register&&<label>{t('Повтори пароль','Repeat password')}<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending}/></label>}
          <p className="field-note">{register?t('Логин: 3–24 латинских буквы, цифры или _. Пароль: от 12 символов.','Username: 3–24 Latin letters, digits, or _. Password: at least 12 characters.'):t('Регистр логина не важен. Пароль вводится точно как при создании аккаунта.','Username is case-insensitive. Enter your password exactly as created.')}</p>
          {register&&delivery!=='email'&&<p className="field-note">{delivery==='local-test'?t('Локальный тест почты: письмо будет сохранено в data/mail-preview, не отправлено наружу.','Local mail test: the message is saved in data/mail-preview, not sent externally.'):t('Почта пока не подключена. Регистрация станет доступна после настройки отправки.','Email is not configured yet. Registration will be available after setup.')}</p>}
        </>}
        <button className="submit-button" disabled={pending||!available||(register&&!verification&&delivery==='unavailable')} type="submit">{pending?t('Подожди…','Please wait…'):register?verification?t('Подтвердить и войти','Verify and sign in'):t('Получить код','Get code'):t('Войти','Sign in')}</button>
        <button className="auth-switch" type="button" disabled={pending} onClick={()=>{setRegister(v=>!v);setError('');}}>{register?t('Уже есть аккаунт? Войти','Already have an account? Sign in'):verification?t('Продолжить подтверждение почты','Continue email verification'):t('Нет аккаунта? Регистрация','No account? Register')}</button>
        {register&&verification&&<button type="button" className="auth-switch" disabled={pending} onClick={()=>{remember(null);setError('');}}>{t('Начать регистрацию заново','Start registration again')}</button>}
      </form>}
      {error&&<p role="alert" className="auth-error">{error}</p>}
    </DialogContent></Dialog></>;
}
