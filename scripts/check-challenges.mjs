import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { challenges } from '../lib/challenges.ts';

const py = await loadPyodide({ indexURL: path.resolve('node_modules/pyodide') });
const harness = readFileSync('public/python-worker.mjs','utf8').match(/py\.runPython\(`([\s\S]*?)`\)/)[1];
const solutions = [
`def positive_sum(numbers):\n    return sum(x for x in numbers if x > 0)`,
`def find_missing(numbers):\n    n = len(numbers) + 1\n    return n * (n+1)//2 - sum(numbers)`,
`def is_palindrome(text):\n    t = ''.join(c.lower() for c in text if c.isalnum())\n    return t == t[::-1]`,
`from collections import Counter\ndef first_unique(text):\n    freq = Counter(text)\n    return next((c for c in text if freq[c]==1), '')`,
`def balanced(text):\n    stack = []\n    pairs = {')':'(', ']':'[', '}':'{'}\n    for c in text:\n        if c in '([{': stack.append(c)\n        elif not stack or stack.pop()!=pairs[c]: return False\n    return not stack`,
`def flatten(items):\n    out=[]\n    for v in items:\n        out.extend(flatten(v) if isinstance(v,list) else [v])\n    return out`,
`from collections import deque\ndef shortest_path(grid):\n    m,n=len(grid),len(grid[0])\n    if grid[0][0] or grid[-1][-1]: return -1\n    q=deque([(0,0,0)]); seen={(0,0)}\n    while q:\n        r,c,d=q.popleft()\n        if (r,c)==(m-1,n-1): return d\n        for a,b in [(r+1,c),(r-1,c),(r,c+1),(r,c-1)]:\n            if 0<=a<m and 0<=b<n and not grid[a][b] and (a,b) not in seen:\n                seen.add((a,b));q.append((a,b,d+1))\n    return -1`,
`def count_islands(grid):\n    count=0; seen=set(); m,n=len(grid),len(grid[0])\n    for r in range(m):\n        for c in range(n):\n            if not grid[r][c] or (r,c) in seen: continue\n            count+=1; stack=[(r,c)];seen.add((r,c))\n            while stack:\n                a,b=stack.pop()\n                for x,y in [(a+1,b),(a-1,b),(a,b+1),(a,b-1)]:\n                    if 0<=x<m and 0<=y<n and grid[x][y] and (x,y) not in seen:\n                        seen.add((x,y));stack.append((x,y))\n    return count`,
`def merge_intervals(intervals):\n    out=[]\n    for a,b in sorted(intervals):\n        if out and a<=out[-1][1]: out[-1][1]=max(out[-1][1],b)\n        else: out.append([a,b])\n    return out`,
`from bisect import bisect_left\ndef leftmost(numbers,target):\n    i=bisect_left(numbers,target)\n    return i if i<len(numbers) and numbers[i]==target else -1`,
`def tree_depth(tree):\n    return 0 if tree is None else 1+max(tree_depth(tree[1]),tree_depth(tree[2]))`,
`from heapq import heappush,heappop\ndef shortest_route(n,edges,start,target):\n    adj=[[] for _ in range(n)]\n    for a,b,w in edges: adj[a].append((b,w));adj[b].append((a,w))\n    d=[float('inf')]*n; d[start]=0; q=[(0,start)]\n    while q:\n        cost,v=heappop(q)\n        if cost!=d[v]:continue\n        if v==target:return cost\n        for u,w in adj[v]:\n            if cost+w<d[u]: d[u]=cost+w;heappush(q,(d[u],u))\n    return -1`,
`def climb_ways(n):\n    a,b=1,1\n    for _ in range(n): a,b=b,a+b\n    return a`,
`def max_subarray(numbers):\n    best=cur=numbers[0]\n    for v in numbers[1:]:\n        cur=max(v,cur+v);best=max(best,cur)\n    return best`,
`from bisect import bisect_left\ndef summit(heights):\n    tails=[]\n    for h in heights:\n        i=bisect_left(tails,h)\n        if i==len(tails):tails.append(h)\n        else:tails[i]=h\n    return len(tails)`
];
function run(c,code){py.globals.set('_payload_json',JSON.stringify({fn:c.fn,tests:c.tests,code}));return JSON.parse(py.runPython(harness));}
let tests=0;
for(const [i,c] of challenges.entries()){
  const r=run(c,solutions[i]);
  assert.equal(r.error,null,`Challenge ${c.id}: ${r.error}`);
  assert.equal(r.results.every(x=>x.passed),true,`Challenge ${c.id}: ${JSON.stringify(r.results)}`);
  tests+=r.results.length;
}
const alternate=run(challenges[0], 'def positive_sum(numbers):\n    total=0\n    for n in numbers:\n        if n>0: total+=n\n    return total');
assert(alternate.results.every(x=>x.passed));
assert(run(challenges[0], 'def positive_sum(numbers):\n    return 999').results.every(x=>!x.passed));
assert(run(challenges[0], 'def positive_sum(numbers)\n    pass').error.includes('SyntaxError'));
assert(run(challenges[0], 'def positive_sum(numbers):\n    raise ValueError("test")').results.every(x=>!x.passed));
console.log(`PASS: ${challenges.length} challenges, ${tests} cases, alternative implementation, wrong answer, syntax error, runtime error.`);
