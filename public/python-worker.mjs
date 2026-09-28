import { loadPyodide } from './runtime/python/pyodide.mjs';

// This is a local training runner, not a trusted multiplayer judge.
// Each run receives a fresh Worker. The parent enforces wall time and disposes it.
self.onmessage = async ({ data }) => {
  try {
    const py = await loadPyodide({ indexURL: new URL('./runtime/python/', self.location.href).href });
    py.setStdout({ batched() {} });
    py.setStderr({ batched() {} });
    self.postMessage({ type: 'ready' });
    py.globals.set('_payload_json', JSON.stringify(data));
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
    self.postMessage({ type: 'result', ...JSON.parse(output) });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error).slice(-1800) });
  }
};
