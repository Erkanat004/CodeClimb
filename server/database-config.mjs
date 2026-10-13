import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

export const databaseConfigPath=()=>process.env.DB_CONFIG_PATH??'data/database-config.json';
const keyBytes=secret=>{
  if(typeof secret!=='string'||secret.length<32)throw Error('DB_CONFIG_KEY must contain at least 32 random characters.');
  return createHash('sha256').update(secret).digest();
};

export async function readDatabaseConfig(secret,file=databaseConfigPath()){
  let packed;try{packed=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw Error('Saved database configuration is unreadable.');}
  try{
    if(packed.version!==1)throw Error();
    const decipher=createDecipheriv('aes-256-gcm',keyBytes(secret),Buffer.from(packed.iv,'base64'));
    decipher.setAuthTag(Buffer.from(packed.tag,'base64'));
    const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(packed.ciphertext,'base64')),decipher.final()]).toString('utf8'));
    if(data.driver!=='postgres'||typeof data.url!=='string')throw Error();
    return data;
  }catch{throw Error('Saved database configuration cannot be decrypted. Check DB_CONFIG_KEY.');}
}

export async function writeDatabaseConfig(url,secret,file=databaseConfigPath()){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyBytes(secret),iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify({driver:'postgres',url})),cipher.final()]);
  const packed=JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
  await mkdir(path.dirname(path.resolve(file)),{recursive:true});
  const temporary=file+'.'+randomBytes(8).toString('hex')+'.tmp';
  try{await writeFile(temporary,packed,{mode:0o600,flag:'wx'});await rename(temporary,file);}finally{await rm(temporary,{force:true}).catch(()=>{});}
}
