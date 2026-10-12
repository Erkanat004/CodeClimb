// The compiler and program live in an opaque-origin Worker, never on the server.
self.onmessage=async({data:{assets,payload}})=>{
  self.onmessage=null;
  const send=self.postMessage.bind(self);
  try {
    self.fetch=async input=>{
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if(url.origin!=='https://runner.invalid'||!Object.hasOwn(assets,url.pathname))return new Response('',{status:404});
      return new Response(assets[url.pathname]);
    };
    const url=URL.createObjectURL(new Blob([assets['/runtime/cpp/clang-wasm-toolchain.global.js']],{type:'text/javascript'}));
    importScripts(url);
    const tc=await self.clangWasmToolchain.createToolchain({baseUrl:'https://runner.invalid/runtime/cpp/'});
    send({type:'compiling'});
    // Limit compiler errors and bound diagnostics returned to the page.
    let diagnostic='';tc.runtime.log=true;
    // The callback installed by the library reaches its capture collector.
    const built=await tc.captureCompilerOutput(()=>tc.runtime.compileArtifact(payload.code,{
      language:'CPP',fileName:'solution.cpp',compileArgs:['-std=c++20','-O1','-ferror-limit','8','-ftemplate-depth=128','-fconstexpr-steps=1000000'],
    }));
    diagnostic=self.clangWasmToolchain.compilerDiagnostics(built.raw).join('\n').slice(-4000);
    if(built.error)throw Error(diagnostic||String(built.error));
    const artifact=built.result;
    artifact.bytes=capMemory(artifact.bytes,4096); // 256 MiB of program linear memory
    delete artifact.wasm; // Never reuse the uncapped module emitted by the compiler.
    self.fetch=()=>Promise.reject(Error('NETWORK DISABLED'));
    send({type:'ready'});
    const start=performance.now();const results=[];let stdout='';
    for(let i=0;i<payload.tests.length;i++){
      let output='',size=0,read=false;
      const collect=chunk=>{size+=chunk.length;if(size>16384)throw Error('OUTPUT LIMIT · Вывод больше 16 КБ');output+=chunk;};
      try{
        const run=await tc.execute(artifact,{stdin:()=>read?null:(read=true,`${i}\n`),stdout:collect,stderr:collect});
        const match=output.match(/\nCLIMB_RESULT:([^\n]*)\n/);
        if(run.exitCode!==0)throw Error(`RUNTIME ERROR · код завершения ${run.exitCode}`);
        if(!match)throw Error('Функция не вернула результат');
        const value=JSON.parse(match[1]);
        results.push({passed:JSON.stringify(value)===JSON.stringify(payload.tests[i].expected),actual:JSON.stringify(value).slice(0,300),expected:JSON.stringify(payload.tests[i].expected).slice(0,300)});
        stdout+=(output.slice(0,match.index)+output.slice(match.index+match[0].length)).slice(0,4000-stdout.length);
      }catch(e){results.push({passed:false,actual:String(e).slice(0,300),expected:JSON.stringify(payload.tests[i].expected).slice(0,300)});}
    }
    send({type:'result',results,stdout,ms:Math.round(performance.now()-start)});
  }catch(e){send({type:'error',error:String(e.message??e).slice(-4000)});}
};

// Change only the WASM memory limits section, before validation/instantiation.
// Imported/shared/memory64 memories are not accepted for submitted programs.
function capMemory(input,maxPages){
  const b=new Uint8Array(input);let p=8;const parts=[b.slice(0,8)];let found=false;
  function read(){let n=0,s=0,v;do{if(p>=b.length||s>28)throw Error('Invalid WASM');v=b[p++];n+=(v&127)*2**s;s+=7;}while(v&128);return n;}
  function leb(n){const a=[];do{let v=n&127;n=Math.floor(n/128);a.push(v|(n?128:0));}while(n);return a;}
  while(p<b.length){const start=p,id=b[p++],len=read(),end=p+len;if(end>b.length)throw Error('Invalid WASM');
    if(id===5){if(read()!==1)throw Error('Only one program memory is supported');const flags=read();if(flags>1)throw Error('Unsupported memory');const initial=read();const oldMax=flags?read():65536;
      if(initial>maxPages)throw Error('MEMORY LIMIT · 256 МБ');const payload=[1,1,...leb(initial),...leb(Math.min(oldMax,maxPages))];parts.push(Uint8Array.from([5,...leb(payload.length),...payload]));found=true;
    }else parts.push(b.slice(start,end));p=end;
  }
  if(!found)throw Error('Program memory not found');
  const out=new Uint8Array(parts.reduce((s,a)=>s+a.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
