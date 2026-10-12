import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameProgressContent} from '../lib/progress.ts';
test('clock does not block navigation; unsaved solutions and progress remain protected',()=>{
  const state={completed:2,avatar:0,drafts:{2:'my code'},seconds:9};
  const saved=JSON.stringify(state);
  assert(sameProgressContent(saved,JSON.stringify({...state,seconds:10})));
  for(const change of [{completed:3},{avatar:1},{drafts:{2:'changed'}}]){
    assert(!sameProgressContent(saved,JSON.stringify({...state,...change})));
  }
  assert(!sameProgressContent('',saved));assert(!sameProgressContent('invalid',saved));
});
