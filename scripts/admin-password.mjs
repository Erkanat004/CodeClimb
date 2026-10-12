import {emitKeypressEvents} from 'node:readline';
import {hashPassword} from '../server/auth.mjs';
if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal. Do not put passwords in command arguments.');
emitKeypressEvents(process.stdin);
async function secret(prompt){
  process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function done(){process.stdin.removeListener('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
    function onKey(text,key={}){
      if(key.ctrl&&key.name==='c'){done();reject(Error('Cancelled.'));return;}
      if(key.name==='return'||key.name==='enter'){done();resolve(value);return;}
      if(key.name==='backspace'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b');}return;}
      if(text&&!key.ctrl&&!key.meta&&!/[\x00-\x1f\x7f]/.test(text)&&value.length+text.length<=128){value+=text;process.stdout.write('*'.repeat(text.length));}
    }
    process.stdin.on('keypress',onKey);
  });
}
try{
  const password=await secret('New admin password (12–128 characters): ');
  if(password.length<12||password.length>128)throw Error('Use 12–128 characters.');
  if(password!==await secret('Confirm password: '))throw Error('Passwords do not match.');
  console.log('Put this value in your private environment file, never in frontend code:');
  console.log('ADMIN_PASSWORD_HASH='+await hashPassword(password));
}catch(error){console.error(error.message);process.exitCode=1;}
