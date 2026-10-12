export type Language = 'python' | 'cpp';
export type RunResult = { results:{passed:boolean;actual:string;expected:string}[]; error?:string;stdout?:string;ms?:number };
type Payload = {code:string;fn:string;tests:{args:unknown[];expected:unknown}[]};
const assets:Record<Language,string[]> = {
  python:['/python-worker.mjs','/runtime/python/pyodide.mjs','/runtime/python/pyodide.asm.mjs','/runtime/python/pyodide.asm.wasm','/runtime/python/pyodide-lock.json','/runtime/python/python_stdlib.zip'],
  cpp:['/cpp-worker.mjs','/runtime/cpp/clang-wasm-toolchain.global.js','/runtime/cpp/runtime-manifest.v1.json','/runtime/cpp/bin/clang.wasm.gz','/runtime/cpp/bin/lld.wasm.gz','/runtime/cpp/bin/memfs.wasm.gz','/runtime/cpp/bin/sysroot.tar.gz'],
};
type Receipt={sha256:string;bytes:number;decoded?:{sha256:string;bytes:number}};
let manifestPromise:Promise<Record<string,Receipt>>|undefined;
const cache=new Map<Language,Promise<Record<string,ArrayBuffer>>>();
async function loadAssets(language:Language) {
  if(!cache.has(language)) cache.set(language,(async()=>{
    manifestPromise??=fetch('/runtime/integrity.json',{credentials:'same-origin',cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Манифест среды недоступен');return r.json() as Promise<Record<string,Receipt>>;}).catch(e=>{manifestPromise=undefined;throw e;});
    const manifest=await manifestPromise;
    return Object.fromEntries(await Promise.all(assets[language].map(async url=>{
      const entry=manifest[url];if(!entry)throw Error('Неизвестный ресурс среды');
      const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw Error('Не удалось загрузить '+url);
      const b=await r.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
      if(![entry,entry.decoded].some(r=>r&&b.byteLength===r.bytes&&hash===r.sha256))throw Error('Проверка целостности среды не пройдена. Обнови страницу.');
      return [url,b];
    })));
  })().catch(e=>{cache.delete(language);throw e;}));
  return cache.get(language)!;
}

// Only this fixed bootstrap executes in the opaque-origin iframe. Player text never
// enters HTML or the iframe JS: it is structured-cloned directly into its Worker.
// No allow-same-origin, navigation, popups, forms, downloads or storage grants.
const frameDocument=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script>
(()=>{let used=false;addEventListener('message',e=>{
 if(used||e.source!==parent||!e.ports[0])return;used=true;
 const port=e.ports[0];let w;
 try {
   const source=new TextDecoder().decode(e.data.assets['/'+e.data.language+'-worker.mjs']);
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
   w=new Worker(url);
   let messages=0, size=0;
   w.onmessage=event=>{if(++messages>12){w.terminate();port.postMessage({type:'error',error:'Слишком много сообщений среды'});return;}
     let value;try{value=JSON.stringify(event.data);}catch{return;}
     size+=value.length;if(size>64000){w.terminate();port.postMessage({type:'error',error:'Превышен лимит вывода'});return;}
     port.postMessage(event.data);
   };
   w.onerror=event=>port.postMessage({type:'error',error:'Изолированная среда: '+String(event.message||'остановлена браузером').slice(0,1200)});
   port.onmessage=()=>{w.terminate();URL.revokeObjectURL(url);port.close();};
   w.postMessage({payload:e.data.payload,assets:e.data.assets});
 }catch{port.postMessage({type:'error',error:'Браузер не смог создать изолированную среду'});}
});})();<\/script>`;

export function startSandbox(language:Language,payload:Payload,onPhase:(p:'loading'|'compiling'|'running')=>void,onResult:(r:RunResult)=>void) {
  let disposed=false, frame:HTMLIFrameElement|undefined, channel:MessageChannel|undefined;
  let phase='loading'; const expected=payload.tests.length;
  let timer:ReturnType<typeof setTimeout>;
  const dispose=()=>{if(disposed)return;disposed=true;clearTimeout(timer);channel?.port1.postMessage('stop');channel?.port1.close();frame?.remove();};
  const finish=(r:RunResult)=>{if(disposed)return;dispose();onResult(r);};
  const timeout=(ms:number,message:string)=>{clearTimeout(timer);timer=setTimeout(()=>finish({results:[],error:message}),ms);};
  if(payload.code.length>200000){queueMicrotask(()=>finish({results:[],error:'Программа слишком большая.'}));return {terminate:dispose};}
  onPhase('loading');timeout(120000,'Загрузка среды заняла больше 120 секунд. Повтори попытку.');
  loadAssets(language).then(data=>{
    if(disposed)return;
    frame=document.createElement('iframe');frame.hidden=true;frame.title='Изолированный запуск '+language;
    frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
    frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; usb 'none'; serial 'none'; payment 'none'");
    channel=new MessageChannel();
    channel.port1.onmessage=({data:d})=>{
      if(disposed||!d||typeof d!=='object')return;
      if(d.type==='compiling'&&phase==='loading'&&language==='cpp'){
        phase='compiling';onPhase('compiling');timeout(30000,'COMPILATION TIME LIMIT · Компиляция дольше 30 секунд.');
      }else if(d.type==='ready'&&(phase==='loading'||phase==='compiling')){
        phase='running';onPhase('running');timeout(3000,'TIME LIMIT EXCEEDED · Выполнение дольше 3 секунд.');
      }else if(d.type==='error'&&typeof d.error==='string') finish({results:[],error:d.error.slice(0,4000)});
      else if(d.type==='result'&&phase==='running'){
        if(!Array.isArray(d.results)||d.results.length!==expected||d.results.some((r:unknown)=>!r||typeof r!=='object'||typeof (r as {passed:unknown}).passed!=='boolean')){
          finish({results:[],error:'Среда вернула некорректный результат.'});return;
        }
        finish({results:d.results.map((r:{passed:boolean;actual:unknown;expected:unknown})=>({passed:r.passed,actual:String(r.actual).slice(0,300),expected:String(r.expected).slice(0,300)})),error:typeof d.error==='string'?d.error.slice(0,4000):undefined,stdout:typeof d.stdout==='string'?d.stdout.slice(0,4000):undefined,ms:typeof d.ms==='number'&&Number.isFinite(d.ms)?d.ms:undefined});
      }
    };
    frame.onload=()=>{if(!disposed)frame!.contentWindow!.postMessage({language,payload,assets:data},'*',[channel!.port2]);};
    frame.srcdoc=frameDocument;document.body.appendChild(frame);
  }).catch(e=>finish({results:[],error:String(e).slice(0,1000)}));
  return {terminate:dispose};
}
