import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createMailer({mode='disabled',apiKey='',from='',outbox='data/mail-preview',production=false,fetcher=fetch}={}){
  if(production&&(mode!=='resend'||!apiKey||!from))throw Error('Production requires MAIL_MODE=resend, RESEND_API_KEY and MAIL_FROM.');
  if(!['disabled','file','resend'].includes(mode))throw Error('Unsupported MAIL_MODE.');
  if(mode==='resend'&&(!apiKey||!from))throw Error('Configure RESEND_API_KEY and MAIL_FROM.');
  return {
    mode,
    async sendCode({email,code,id}){
      const text=`Код подтверждения CODE CLIMB: ${code}\n\nКод действует 10 минут. Никому его не сообщайте. Если вы не регистрировались, проигнорируйте письмо.`;
      if(mode==='disabled')throw Error('Почта пока не настроена. Администратор должен подключить отправку писем.');
      if(mode==='file'){
        const dir=path.resolve(outbox);
        await mkdir(dir,{recursive:true});
        await writeFile(path.join(dir,`${id}.txt`),`LOCAL TEST MAIL — not sent\nTo: ${email}\n\n${text}\n`,{mode:0o600});
        return;
      }
      const response=await fetcher('https://api.resend.com/emails',{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({from,to:[email],subject:'Код регистрации в CODE CLIMB',text}),
      });
      if(!response.ok)throw Error('Не удалось отправить письмо. Повторите позже.');
    },
  };
}
