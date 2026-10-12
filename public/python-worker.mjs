// Runs only inside the opaque-origin sandbox. CSP, not this fetch adapter,
// is the network boundary. No handles to the host filesystem are provided.
self.onmessage = async ({ data }) => {
  self.onmessage = null;
  const send = self.postMessage.bind(self);
  try {
    const {assets,payload}=data;
    const moduleURL=path=>URL.createObjectURL(new Blob([assets[path]],{type:'text/javascript'}));
    const {loadPyodide}=await import(moduleURL('/runtime/python/pyodide.mjs'));
    const {default:createModule}=await import(moduleURL('/runtime/python/pyodide.asm.mjs'));
    self.fetch=async input=>{
      const path=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url).pathname;
      if(!Object.hasOwn(assets,path))throw new Error('NETWORK DISABLED');
      return new Response(assets[path],{headers:{'Content-Type':path.endsWith('.wasm')?'application/wasm':'application/octet-stream'}});
    };
    const py = await loadPyodide({indexURL:'https://runner.invalid/runtime/python/',
      createPyodideModule:options=>createModule({...options,wasmBinary:assets['/runtime/python/pyodide.asm.wasm']}),
      lockFileContents:new TextDecoder().decode(assets['/runtime/python/pyodide-lock.json']),
      stdout(){},stderr(){}});
    // Defense in depth; origin sandbox and CSP remain the security boundaries.
    for(const key of ['Worker','SharedWorker','WebSocket','EventSource','XMLHttpRequest','BroadcastChannel']) {
      try{Object.defineProperty(self,key,{value:undefined,writable:false,configurable:false});}catch{}
    }
    self.fetch=()=>Promise.reject(new Error('NETWORK DISABLED'));
    py.setStdout({ batched() {} });
    py.setStderr({ batched() {} });
    send({ type: 'ready' });
    py.globals.set('_payload_json', JSON.stringify(payload));
    const output = py.runPython(`
import json, time, traceback, io, contextlib
p = json.loads(_payload_json)
ns = {}
results = []
begin = time.perf_counter()
class LimitedOutput(io.TextIOBase):
    def __init__(self): self.parts = []; self.size = 0
    def write(self, text):
        if self.size < 4000:
            part = text[:4000-self.size]
            self.parts.append(part)
            self.size += len(part)
        return len(text)
    def getvalue(self): return ''.join(self.parts)
capture = LimitedOutput()
error = None
with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
    try:
        exec(compile(p['code'], 'solution.py', 'exec'), ns)
        fn = ns.get(p['fn'])
        if not callable(fn): raise ValueError('Нужна функция ' + p['fn'])
        for case in p['tests']:
            try:
                actual = fn(*case['args'])
                results.append({'passed': actual == case['expected'], 'actual': repr(actual)[:300], 'expected': repr(case['expected'])[:300]})
            except BaseException as ex:
                results.append({'passed': False, 'actual': type(ex).__name__ + ': ' + str(ex)[:300], 'expected': repr(case['expected'])[:300]})
    except BaseException:
        error = traceback.format_exc(limit=3)[-1800:]
json.dumps({'results': results, 'error': error, 'stdout': capture.getvalue(), 'ms': round((time.perf_counter()-begin)*1000, 2)}, ensure_ascii=False)
`);
    const result=JSON.parse(output);
    if(result.error)send({type:'error',error:result.error});
    else send({ type: 'result', ...result });
  } catch (error) {
    send({ type: 'error', error: String(error).slice(-1800) });
  }
};
