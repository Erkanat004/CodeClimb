import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { hashPassword,verifyPassword,hashToken,sessionToken,cookie,newToken,verificationCode,codeHash,sameHash } from './auth.mjs';
import { createMailer } from './mail.mjs';
import {createJudgeClient} from './judge-client.mjs';
import {featureRoutes} from './feature-routes.mjs';

const EMPTY={completed:0,drafts:{},avatar:0,seconds:0};
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const publicUser=u=>({id:u.id,username:u.username,email:u.email??null,email_verified_at:u.email_verified_at??null,role:u.role??'player'});
function validProgress(p,count){
  if(!p||!Number.isInteger(p.completed)||p.completed<0||p.completed>count||!Number.isInteger(p.avatar)||p.avatar<0||p.avatar>3||!Number.isInteger(p.seconds)||p.seconds<0||p.seconds>31536000||!p.drafts||typeof p.drafts!=='object'||Array.isArray(p.drafts))return false;
  const entries=Object.entries(p.drafts);
  return entries.length<=count&&entries.every(([k,v])=>/^(?:[0-9]|1[0-4])$/.test(k)&&Number(k)<count&&typeof v==='string'&&v.length<=30000);
}
async function body(req,max=500000){
  if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Ожидается JSON.');
  let size=0;const parts=[];
  for await(const chunk of req){size+=chunk.length;if(size>max)throw new HttpError(413,'Слишком большой запрос.');parts.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new HttpError(400,'Ожидается JSON-объект.');}
}
export async function createAccountServer({
  repository,origin='http://localhost:5173',publicMode=false,proxyToken='',otpSecret,
  mailer=createMailer(),adminUsername='admin996',nowFn=Date.now,judge=createJudgeClient(),adSecret='',
}){
  const expected=new URL(origin);
  if(expected.origin!==origin||expected.username||expected.password)throw Error('APP_ORIGIN must be an exact origin without paths or credentials.');
  if(publicMode){
    if(expected.protocol!=='https:'||proxyToken.length<32||(otpSecret??'').length<32||mailer.mode!=='resend')throw Error('Public mode requires HTTPS, trusted proxy token, OTP secret and configured email delivery.');
  }else if(expected.protocol!=='http:'||!['localhost','127.0.0.1'].includes(expected.hostname))throw Error('Development mode requires loopback HTTP.');
  otpSecret??=newToken();
  const dummy=await hashPassword('not-an-account-'+randomUUID());let hashing=0;
  const secure=publicMode;
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    const send=(status,data,type='application/json; charset=utf-8')=>{
      res.setHeader('Content-Type',type);
      res.writeHead(status);
      res.end(typeof data==='string'?data:JSON.stringify(data));
    };
    try{
      const host=req.headers.host??'';
      if(publicMode){
        if(host!==expected.host||!sameHash(hashToken(String(req.headers['x-code-climb-proxy']??'')),hashToken(proxyToken)))throw new HttpError(403,'Недопустимый адрес сервера.');
      }else if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host))throw new HttpError(403,'Недопустимый адрес сервера.');
      const parsed=new URL(req.url,'http://localhost'),route=parsed.pathname;
      if(!route.startsWith('/api/account/'))throw new HttpError(404,'Не найдено.');
      if(!['GET','POST','PUT'].includes(req.method))throw new HttpError(405,'Метод не поддерживается.');
      if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-code-climb']!=='1'))throw new HttpError(403,'Запрос с другого сайта запрещён.');
      if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Запрос с другого сайта запрещён.');
      const now=nowFn(),token=sessionToken(req),user=token?await repository.getSession(hashToken(token),now):null;
      const forwarded=String(req.headers['x-code-climb-client-ip']??'');
      const address=publicMode&&isIP(forwarded)?forwarded:req.socket.remoteAddress??'local';
      async function limit(key,max=10,window=900000){if(!await repository.rateLimit(hashToken(key),max,window,now))throw new HttpError(429,'Слишком много попыток. Подожди и повтори позже.');}
      async function issueSession(account){
        if(token)await repository.deleteSession(hashToken(token));
        const fresh=newToken();if(!await repository.createSession(hashToken(fresh),account.id,now+604800000,account.password_hash??null))throw new HttpError(401,'Аккаунт изменён. Войди заново.');
        res.setHeader('Set-Cookie',cookie(fresh,false,secure));send(200,{user:publicUser(account)});
      }
      if(route==='/api/account/me'&&req.method==='GET'){send(200,{user,registration:{delivery:mailer.mode==='file'?'local-test':mailer.mode==='disabled'?'unavailable':'email'}});return;}
      if(route==='/api/account/register'&&req.method==='POST'){
        const p=await body(req,8192),username=typeof p.username==='string'?p.username.trim().toLowerCase():'',password=p.password,email=typeof p.email==='string'?p.email.trim().toLowerCase():'';
        if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128||email.length>254||!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw new HttpError(400,'Укажи логин, действующий email и пароль от 12 до 128 символов.');
        await limit('register-ip:'+address,10);await limit('register-email:'+email,5);
        if(username===adminUsername.toLowerCase())throw new HttpError(409,'Этот логин недоступен.');
        if(mailer.mode==='disabled')throw new HttpError(503,'Отправка писем пока не подключена. Можно играть гостем или войти в существующий аккаунт.');
        if(await repository.findUser(username)||await repository.findEmail(email))throw new HttpError(409,'Логин или email уже используются.');
        if(hashing>=2)throw new HttpError(429,'Сервер занят. Повтори через несколько секунд.');
        let passwordHash;hashing++;try{passwordHash=await hashPassword(password);}finally{hashing--;}
        const id=newToken(),code=verificationCode();
        if(!await repository.createPending({id,username,email,passwordHash,codeHash:codeHash(otpSecret,id,code)},now))throw new HttpError(409,'Регистрация с этими данными уже начата. Введи код из письма или повтори через 10 минут.');
        try{await mailer.sendCode({email,code,id});}catch{await repository.deletePending(id);throw new HttpError(503,'Не удалось отправить код. Проверь email и повтори позже.');}
        send(202,{challengeId:id,expiresIn:600,resendAfter:60,delivery:mailer.mode==='file'?'local-test':'email'});return;
      }
      if(route==='/api/account/verify-email'&&req.method==='POST'){
        const p=await body(req,8192);await limit('verify-ip:'+address,40);
        if(typeof p.challengeId!=='string'||!/^[a-f0-9]{64}$/.test(p.challengeId)||typeof p.code!=='string'||!/^\d{6}$/.test(p.code))throw new HttpError(400,'Введи шестизначный код из письма.');
        const result=await repository.verifyRegistration(p.challengeId,codeHash(otpSecret,p.challengeId,p.code),now);
        if(result.error)throw new HttpError(400,'Код неверный, истёк или исчерпан лимит попыток. Запроси новый код.');
        await issueSession(result.user);return;
      }
      if(route==='/api/account/resend-code'&&req.method==='POST'){
        const p=await body(req,8192);await limit('resend-ip:'+address,10);
        const pending=typeof p.challengeId==='string'?await repository.getPending(p.challengeId):null;
        if(!pending||pending.expires_at<=now)throw new HttpError(400,'Регистрация истекла. Начни заново.');
        if(now-pending.sent_at<60000)throw new HttpError(429,'Новый код можно запросить через минуту.');
        await limit('resend-challenge:'+pending.id,1,60000);await limit('resend-email:'+pending.email,5);
        const code=verificationCode();
        try{await mailer.sendCode({email:pending.email,code,id:pending.id});}catch{throw new HttpError(503,'Не удалось отправить новый код. Предыдущий код продолжает действовать.');}
        if(!await repository.rotateCode(pending.id,pending.code_hash,codeHash(otpSecret,pending.id,code),now))throw new HttpError(409,'Регистрация уже завершена или изменена.');
        send(200,{ok:true,expiresIn:600,resendAfter:60});return;
      }
      if(route==='/api/account/login'&&req.method==='POST'){
        const p=await body(req,8192),username=typeof p.username==='string'?p.username.trim().toLowerCase():'',password=p.password;
        if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<1||password.length>128)throw new HttpError(400,'Проверь логин и пароль.');
        await limit('login-ip:'+address,30);await limit('login:'+username,10);
        if(hashing>=2)throw new HttpError(429,'Сервер занят. Повтори через несколько секунд.');
        let found,correct;hashing++;try{found=await repository.findUser(username);correct=await verifyPassword(password,found?.password_hash??dummy);}finally{hashing--;}
        if(!found||!correct||found.disabled)throw new HttpError(401,'Неверный логин или пароль, либо аккаунт заблокирован.');
        await issueSession(found);return;
      }
      if(route==='/api/account/logout'&&req.method==='POST'){
        if(token)await repository.deleteSession(hashToken(token));res.setHeader('Set-Cookie',cookie('',true,secure));send(200,{ok:true});return;
      }
      if(route==='/api/account/password'&&req.method==='POST'){
        if(!user)throw new HttpError(401,'Войди в аккаунт.');
        await limit('password:'+user.id,5);await limit('password-ip:'+address,15);
        const p=await body(req,8192);
        if(typeof p.currentPassword!=='string'||p.currentPassword.length>128||typeof p.newPassword!=='string'||p.newPassword.length<12||p.newPassword.length>128||p.newPassword===p.currentPassword)throw new HttpError(400,'Новый пароль должен отличаться от текущего и содержать 12–128 символов.');
        if(hashing>=2)throw new HttpError(429,'Сервер занят. Повтори позже.');
        hashing++;let found,nextHash;
        try{found=await repository.findUser(user.username);if(!found||!await verifyPassword(p.currentPassword,found.password_hash))throw new HttpError(400,'Текущий пароль неверный.');nextHash=await hashPassword(p.newPassword);}finally{hashing--;}
        const fresh=newToken();
        if(!await repository.changePassword(user.id,found.password_hash,nextHash,hashToken(token),hashToken(fresh),now))throw new HttpError(409,'Сессия или пароль изменились. Войди заново.');
        res.setHeader('Set-Cookie',cookie(fresh,false,secure));send(200,{ok:true});return;
      }
      if(await featureRoutes({route,parsed,req,send,body,user,now,repository,judge,adSecret,publicMode,limit,fail:(status,message)=>{throw new HttpError(status,message);},clock:nowFn}))return;
      if(route.startsWith('/api/account/admin/')){
        if(!user)throw new HttpError(401,'Войди в аккаунт администратора.');
        if(user.role!=='admin')throw new HttpError(403,'Доступ только для администратора.');
        if(route==='/api/account/admin/overview'&&req.method==='GET'){send(200,{...await repository.adminOverview(now),mailMode:mailer.mode,publicMode});return;}
        if(route==='/api/account/admin/users'&&req.method==='GET'){
          const offset=Number(parsed.searchParams.get('offset')??0),search=(parsed.searchParams.get('q')??'').trim();
          if(!Number.isInteger(offset)||offset<0||offset>1000000||search.length>100)throw new HttpError(400,'Некорректный поиск.');
          send(200,await repository.adminUsers(search,offset));return;
        }
        const target=route.match(/^\/api\/account\/admin\/users\/([a-f0-9-]{36})(?:\/(block|unblock|revoke-sessions))?$/);
        if(target&&req.method==='GET'&&!target[2]){send(200,{progress:await repository.adminProgress(target[1])});return;}
        if(target&&req.method==='POST'&&target[2]){
          await body(req,8192);await limit('admin-actions:'+user.id,60);
          if(!await repository.adminAction(user.id,target[1],target[2],now))throw new HttpError(409,'Аккаунт не найден или защищён от этого действия.');
          send(200,{ok:true});return;
        }
      }
      const course=route.match(/^\/api\/account\/progress\/(python|cpp)(?:\/(easy|medium|hard|classic|full))?$/);
      const language=course?.[1],difficulty=course?.[2]??'classic';
      if(language){
        if(!user)throw new HttpError(401,'Войди в аккаунт.');
        if(req.method==='GET'){send(200,await repository.getProgress(user.id,language,difficulty)??{data:EMPTY,revision:0});return;}
        if(req.method==='PUT'){
          const p=await body(req);if(!validProgress(p.data,['classic','full'].includes(difficulty)?15:5)||!Number.isInteger(p.revision)||p.revision<0)throw new HttpError(400,'Некорректный прогресс.');
          const {completed,drafts,avatar,seconds}=p.data;
          const revision=await repository.saveProgress(user.id,language,{completed,drafts,avatar,seconds},p.revision,difficulty);
          if(revision===null)throw new HttpError(409,'Прогресс изменился в другой вкладке. Перезагрузи страницу, чтобы загрузить актуальную версию.');
          send(200,{revision});return;
        }
      }
      throw new HttpError(404,'Не найдено.');
    }catch(e){const status=e instanceof HttpError?e.status:500;if(status===500)console.error('Account service request failed:',e.code??e.name);if(!res.headersSent)send(status,{error:status===500?'Ошибка сервера. Повтори попытку.':e.message});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=40;server.maxConnections=128;
  const cleanup=setInterval(()=>repository.cleanup(nowFn()).catch(()=>{}),60000);cleanup.unref();
  server.on('close',()=>clearInterval(cleanup));
  return server;
}
