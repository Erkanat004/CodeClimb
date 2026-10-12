import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {createToolchain} from '@live-codes/clang-wasm/toolchain';
import {capWasmMemory} from './wasm-memory.mjs';
import {catalog} from './load-catalog.mjs';
import {cppFull} from '../tests/full-route-solutions.mjs';
const source=readFileSync('lib/cpp-challenges.ts','utf8').replace("'./challenges'",JSON.stringify(pathToFileURL(process.cwd()+'/lib/challenges.ts').href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {cppChallenges,cppProgram,cppHeaders,itemType,treeType}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const bodies=[
'long long positive_sum(vector<int> a){long long s=0;for(int v:a)if(v>0)s+=v;return s;}',
'int find_missing(vector<int> a){int n=a.size()+1;return n*(n+1)/2-accumulate(a.begin(),a.end(),0);}',
'bool is_palindrome(string t){string s;for(unsigned char c:t)if(isalnum(c))s+=tolower(c);string r=s;reverse(r.begin(),r.end());return s==r;}',
'string first_unique(string s){map<char,int> m;for(char c:s)m[c]++;for(char c:s)if(m[c]==1)return string(1,c);return "";}',
'bool balanced(string s){vector<char> a;map<char,char> m={{\')\',\'(\'},{\']\',\'[\'},{\'}\',\'{\'}};for(char c:s){if(c==\'(\'||c==\'[\'||c==\'{\')a.push_back(c);else{if(a.empty()||a.back()!=m[c])return false;a.pop_back();}}return a.empty();}',
'vector<int> flatten(vector<Item> a){vector<int> r;for(auto x:a){if(x.isInteger)r.push_back(x.value);else{auto b=flatten(x.items);r.insert(r.end(),b.begin(),b.end());}}return r;}',
'int shortest_path(vector<vector<int>> g){int m=g.size(),n=g[0].size();if(g[0][0]||g[m-1][n-1])return -1;vector<vector<int>> d(m,vector<int>(n,-1));queue<pair<int,int>> q;q.push({0,0});d[0][0]=0;int dx[]={0,1,0,-1},dy[]={1,0,-1,0};while(!q.empty()){auto [x,y]=q.front();q.pop();for(int k=0;k<4;k++){int a=x+dx[k],b=y+dy[k];if(a>=0&&a<m&&b>=0&&b<n&&!g[a][b]&&d[a][b]<0){d[a][b]=d[x][y]+1;q.push({a,b});}}}return d[m-1][n-1];}',
'int count_islands(vector<vector<int>> g){int m=g.size(),n=g[0].size(),c=0;function<void(int,int)> f=[&](int x,int y){if(x<0||y<0||x>=m||y>=n||!g[x][y])return;g[x][y]=0;f(x+1,y);f(x-1,y);f(x,y+1);f(x,y-1);};for(int i=0;i<m;i++)for(int j=0;j<n;j++)if(g[i][j]){c++;f(i,j);}return c;}',
'vector<vector<int>> merge_intervals(vector<vector<int>> a){sort(a.begin(),a.end());vector<vector<int>> r;for(auto x:a){if(!r.empty()&&x[0]<=r.back()[1])r.back()[1]=max(r.back()[1],x[1]);else r.push_back(x);}return r;}',
'int leftmost(vector<int> a,int t){auto i=lower_bound(a.begin(),a.end(),t);return i!=a.end()&&*i==t?i-a.begin():-1;}',
'int tree_depth(TreeNode* t){return t?1+max(tree_depth(t->left),tree_depth(t->right)):0;}',
'long long shortest_route(int n,vector<vector<int>> e,int s,int t){vector<vector<pair<int,int>>> g(n);for(auto x:e){g[x[0]].push_back({x[1],x[2]});g[x[1]].push_back({x[0],x[2]});}vector<long long>d(n,LLONG_MAX);d[s]=0;priority_queue<pair<long long,int>,vector<pair<long long,int>>,greater<pair<long long,int>>>q;q.push({0,s});while(!q.empty()){auto [v,u]=q.top();q.pop();if(v!=d[u])continue;for(auto [a,b]:g[u])if(v+b<d[a]){d[a]=v+b;q.push({d[a],a});}}return d[t]==LLONG_MAX?-1:d[t];}',
'long long climb_ways(int n){long long a=1,b=1;while(n--){long long c=a+b;a=b;b=c;}return a;}',
'long long max_subarray(vector<int> a){long long c=a[0],b=c;for(int i=1;i<a.size();i++){c=max((long long)a[i],c+a[i]);b=max(b,c);}return b;}',
'int summit(vector<int> a){vector<int> t;for(int x:a){auto i=lower_bound(t.begin(),t.end(),x);if(i==t.end())t.push_back(x);else *i=x;}return t.size();}'
];
const tc=await createToolchain();
const allChallenges=[...cppChallenges,...catalog.getChallenges('cpp','full')],allBodies=[...bodies,...cppFull];
for(let i=0;i<allChallenges.length;i++){
  const c=allChallenges[i],code=cppHeaders+(i===5?itemType:i===10?treeType:'')+allBodies[i];
  const built=await tc.captureCompilerOutput(()=>tc.runtime.compileArtifact(cppProgram(code,c,c.tests),{language:'CPP',fileName:`check${i}.cpp`,compileArgs:['-std=c++20','-O1','-ferror-limit','8','-ftemplate-depth=128','-fconstexpr-steps=1000000']}));
  assert.ifError(built.error?new Error(built.raw||built.error):null);
  const artifact=built.result;artifact.bytes=capWasmMemory(artifact.bytes,4096);delete artifact.wasm;
  for(let j=0;j<c.tests.length;j++){
    let read=false,output='';await tc.execute(artifact,{stdin:()=>read?null:(read=true,`${j}\n`),stdout:s=>output+=s});
    const match=output.match(/\nCLIMB_RESULT:([^\n]*)\n/);assert(match,output);assert.deepEqual(JSON.parse(match[1]),c.tests[j].expected,`${i+1}/${j+1}`);
  }
  console.log(`PASS C++ ${i+1}/${allChallenges.length} ${c.fn}`);
}
console.log('PASS: C++20 compiler, 30 challenges, 150 test cases, capped WASM memory.');tc.dispose();
