import {createHash} from 'node:crypto';
import {duelTask} from '../server/duel-tasks.mjs';
// Seeds and expected answers stay in the trusted controller, never in a job.
export function buildCases(language,level,secret){
  let seed=createHash('sha256').update(secret+':'+language+':'+level).digest().readUInt32LE();
  const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
  const integer=(min,max)=>min+next()%(max-min+1);
  const array=(n=integer(0,60),min=-1000,max=1000)=>Array.from({length:n},()=>integer(min,max));
  const word=(n=integer(0,25))=>Array.from({length:n},()=>String.fromCharCode(integer(97,122))).join('');
  const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a;};
  const task=duelTask(language,level);if(!task)throw Error('Unknown task');
  const cases=[];
  for(let i=0;i<40;i++){
    let value,answer;
    if(language==='python'){
      if(level===0){value=i===0?[]:i===1?[0,-2,-3,1,2]:array();answer=value.filter(x=>x%2===0).length;}
      if(level===1){value=i===0?0:integer(-1000000000,1000000000);answer=[...String(Math.abs(value))].reduce((a,c)=>a+Number(c),0);}
      if(level===2){const words=Array.from({length:integer(0,15)},()=>word(integer(1,15)));value=i===0?' \t\n ':words.join([' ','  ','\t','\n'][integer(0,3)]);answer=words.reverse().join(' ');}
      if(level===3){value=i===0?[]:array();let sum=0;answer=value.map(x=>sum+=x);}
      if(level===4){value=i===0?[]:Array.from({length:integer(0,30)},()=>word());answer=value.reduce((best,x)=>x.length>best.length?x:best,'');}
    }else{
      if(level===0){value=i===0?[]:array();answer=value.length?Math.max(...value)-Math.min(...value):0;}
      if(level===1){value=i===0?0:integer(0,1000000000);answer=value.toString(2).replaceAll('0','').length;}
      if(level===2){value=i===0?'':Array.from({length:integer(1,12)},()=>word(1).repeat(integer(1,15))).join('');answer='';for(let j=0;j<value.length;){let end=j+1;while(end<value.length&&value[end]===value[j])end++;answer+=value[j]+(end-j);j=end;}}
      if(level===3){value=i===0?[]:array().sort((a,b)=>a-b);answer=value.map(x=>x*x).sort((a,b)=>a-b);}
      if(level===4){value=i===0?[]:array(integer(1,40),0,1000000);answer=value.reduce(gcd,0);}
    }
    cases.push({args:[value],expected:answer});
  }
  return {fn:task.fn,argumentType:language==='cpp'?['vector<int>','int','string','vector<int>','vector<int>'][level]:null,cases};
}
