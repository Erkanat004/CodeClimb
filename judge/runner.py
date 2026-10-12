"""Runs ONLY inside a disposable runsc container. Never run this on the host."""
import sys, json, subprocess, pathlib, resource, os
if os.environ.get("CLIMB_ISOLATED_JOB") != "1":
    raise SystemExit("This runner requires the isolated job container.")

def limits():
    resource.setrlimit(resource.RLIMIT_FSIZE, (16*1024*1024,16*1024*1024))
    resource.setrlimit(resource.RLIMIT_CORE, (0,0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64,64))

def run(args, input_text, seconds):
    # File-backed output avoids unbounded pipes in the supervisor. FS quota
    # and RLIMIT_FSIZE also bound deliberately malicious stdout/stderr.
    with open("/tmp/out", "w+b") as output, open("/tmp/err", "w+b") as error:
        p=subprocess.run(args,input=input_text.encode(),stdout=output,stderr=error,timeout=seconds,preexec_fn=limits,cwd="/tmp",env={"PATH":"/usr/local/bin:/usr/bin:/bin","HOME":"/tmp","LANG":"C.UTF-8"})
        output.seek(0); data=output.read(65537)
        if p.returncode or len(data)>65536: raise ValueError("Execution failed")
        return data.decode()

try:
    payload=json.loads(sys.stdin.buffer.read(131073))
    source=payload["source"]; fn=payload["fn"]
    if len(source)>30000 or not fn.replace("_","").isalnum(): raise ValueError()
    if payload["language"]=="python":
        pathlib.Path("/tmp/solution.py").write_text(source,encoding="utf-8")
        harness='import json,sys,importlib.util\ns=importlib.util.spec_from_file_location("solution","/tmp/solution.py")\nm=importlib.util.module_from_spec(s)\ns.loader.exec_module(m)\na=json.loads(sys.stdin.read())\nprint(json.dumps(getattr(m,'+repr(fn)+')(*a),ensure_ascii=True,allow_nan=False))\n'
        pathlib.Path("/tmp/harness.py").write_text(harness,encoding="utf-8")
        command=["python3","-I","/tmp/harness.py"]
    elif payload["language"]=="cpp":
        kind=payload["argumentType"]
        readers={"vector<int>":"read_vector()","int":"read_int()","string":"read_string()"}
        if kind not in readers: raise ValueError()
        wrapper='\n#include "/opt/adapter.hpp"\nint main(){ auto arg='+readers[kind]+'; climb_emit('+fn+'(arg)); }\n'
        pathlib.Path("/tmp/solution.cpp").write_text(source+wrapper,encoding="utf-8")
        run(["g++","/tmp/solution.cpp","-std=c++20","-O1","-fmax-errors=3","-ftemplate-depth=128","-fconstexpr-ops-limit=1000000","-o","/tmp/solution"],"",20)
        command=["/tmp/solution"]
    else: raise ValueError()
    outputs=[]
    for case in payload["cases"]:
        value=case[0]
        if payload["language"]=="python": input_text=json.dumps(case)
        elif kind=="vector<int>": input_text=str(len(value))+" "+" ".join(map(str,value))
        elif kind=="string": input_text=value.encode().hex() or "-"
        else: input_text=str(value)
        outputs.append(json.loads(run(command,input_text,2)))
    print(json.dumps({"outputs":outputs},ensure_ascii=True,allow_nan=False))
except Exception:
    print('{"failed":true}')
    raise SystemExit(1)
