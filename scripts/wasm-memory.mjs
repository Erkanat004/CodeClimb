// Build-time cap for a WASM32 module's own linear memory; does not claim to cap
// JS heaps, compiler memory or the browser process. Reject unfamiliar formats.
export function capWasmMemory(input,maxPages){
  const b=new Uint8Array(input);let p=8;const parts=[b.slice(0,8)];let found=false;
  function read(){let n=0,s=0,v;do{if(p>=b.length||s>28)throw Error('Invalid WASM');v=b[p++];n+=(v&127)*2**s;s+=7;}while(v&128);return n;}
  function leb(n){const a=[];do{let v=n&127;n=Math.floor(n/128);a.push(v|(n?128:0));}while(n);return a;}
  while(p<b.length){const start=p,id=b[p++],len=read(),end=p+len;if(end>b.length)throw Error('Invalid WASM');
    if(id===5){if(read()!==1)throw Error('Only one memory is supported');const flags=read();if(flags>1)throw Error('Unsupported memory');const initial=read();const oldMax=flags?read():65536;
      if(initial>maxPages)throw Error('Initial memory exceeds cap');const payload=[1,1,...leb(initial),...leb(Math.min(oldMax,maxPages))];parts.push(Uint8Array.from([5,...leb(payload.length),...payload]));found=true;
    }else parts.push(b.slice(start,end));p=end;
  }
  if(!found)throw Error('Defined memory not found');
  const out=new Uint8Array(parts.reduce((s,a)=>s+a.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
