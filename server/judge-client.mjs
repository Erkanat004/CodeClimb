export function createJudgeClient({url='',token='',fetcher=fetch}={}){
  if(!url)return {enabled:false,async status(){return false;},async check(){throw Error('Judge unavailable');}};
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('Remote JUDGE_URL requires HTTPS.');
  if(token.length<32||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('Invalid judge configuration.');
  async function request(path,data){
    const r=await fetcher(new URL(path,endpoint),{method:data?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(data?90000:4000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
    if(!r.ok)throw Error('Judge unavailable');
    const text=await r.text();if(text.length>4096)throw Error('Invalid judge response');
    return JSON.parse(text);
  }
  return {enabled:true,async status(){try{return (await request('/health')).ready===true;}catch{return false;}},
    async check(job){const r=await request('/check',job);if(r.id!==job.id||!['passed','failed','error'].includes(r.status))throw Error('Invalid verdict');return {status:r.status,message:r.status==='passed'?'Все серверные тесты пройдены.':r.status==='failed'?'Решение не прошло проверку. Проверь алгоритм, синтаксис и ограничения.':'Проверка недоступна. Попробуй ещё раз.'};}
  };
}
