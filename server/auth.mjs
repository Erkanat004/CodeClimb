import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
export const hashToken=value=>createHash('sha256').update(value).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=await derive(password,salt,32,options);return `scrypt-v1:${salt}:${hash.toString('hex')}`;}
export async function verifyPassword(password,encoded){
  const [version,salt,hex]=encoded.split(':');
  if(version!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(hex))return false;
  return timingSafeEqual(await derive(password,salt,32,options),Buffer.from(hex,'hex'));
}
export function sessionToken(req){const raw=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('climb_session='))?.slice(14);return /^[a-f0-9]{64}$/.test(raw??'')?raw:null;}
export const cookie=(token,expires=false,secure=false)=>`climb_session=${token}; Path=/api/account; HttpOnly; SameSite=Strict; Max-Age=${expires?0:604800}${secure?'; Secure':''}`;
export const newToken=()=>randomBytes(32).toString('hex');
export const verificationCode=()=>String(randomInt(1000000)).padStart(6,'0');
export const codeHash=(secret,id,code)=>createHmac('sha256',secret).update(id+':'+code).digest('hex');
export const sameHash=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
