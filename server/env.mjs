import { fileURLToPath } from 'node:url';
export function loadLocalEnvironment(){
  if(process.env.NODE_ENV==='production')return;
  try{process.loadEnvFile(fileURLToPath(new URL('../.env.local',import.meta.url)));}
  catch(e){if(e.code!=='ENOENT')throw e;}
}
