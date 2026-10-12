// Reference implementations for tests only; never loaded by the client or API.
export const pythonFull=[
'def count_even(numbers):\n    return sum(x % 2 == 0 for x in numbers)',
'def digit_sum(n):\n    return sum(int(x) for x in str(abs(n)))',
'def reverse_words(text):\n    return " ".join(text.split()[::-1])',
'def running_totals(numbers):\n    out=[]; total=0\n    for x in numbers:\n        total+=x; out.append(total)\n    return out',
'def longest_word(words):\n    return max(words,key=len,default="")',
'def rotate_matrix(grid):\n    return [list(row) for row in zip(*grid[::-1])]',
'def product_except_self(numbers):\n    out=[1]*len(numbers); p=1\n    for i,x in enumerate(numbers): out[i]=p; p*=x\n    p=1\n    for i in range(len(numbers)-1,-1,-1): out[i]*=p; p*=numbers[i]\n    return out',
'def longest_unique(text):\n    last={}; left=0; best=0\n    for i,c in enumerate(text):\n        left=max(left,last.get(c,-1)+1); last[c]=i\n        best=max(best,i-left+1)\n    return best',
'def min_coins(coins,amount):\n    dp=[0]+[amount+1]*amount\n    for n in range(1,amount+1):\n        for c in coins:\n            if c<=n: dp[n]=min(dp[n],dp[n-c]+1)\n    return dp[amount] if dp[amount]<=amount else -1',
'def subarray_count(numbers,target):\n    freq={0:1}; total=0; answer=0\n    for n in numbers:\n        total+=n; answer+=freq.get(total-target,0)\n        freq[total]=freq.get(total,0)+1\n    return answer',
'def edit_distance(a,b):\n    row=list(range(len(b)+1))\n    for i,x in enumerate(a):\n        nxt=[i+1]\n        for j,y in enumerate(b): nxt.append(min(nxt[-1]+1,row[j+1]+1,row[j]+(x!=y)))\n        row=nxt\n    return row[-1]',
'from collections import Counter\ndef min_window(text,pattern):\n    if not pattern: return ""\n    need=Counter(pattern); missing=len(pattern); left=0; best=None\n    for right,c in enumerate(text):\n        if need[c]>0: missing-=1\n        need[c]-=1\n        while missing==0:\n            if best is None or right-left+1<len(best): best=text[left:right+1]\n            old=text[left]; need[old]+=1; left+=1\n            if need[old]>0: missing+=1\n    return best or ""',
'def word_break_count(text,words):\n    words=set(words); dp=[1]+[0]*len(text)\n    for i in range(1,len(text)+1):\n        for word in words:\n            if len(word)<=i and text[i-len(word):i]==word: dp[i]=(dp[i]+dp[i-len(word)])%1000000007\n    return dp[-1]',
'from bisect import bisect_right\ndef weighted_jobs(jobs):\n    jobs=sorted(jobs,key=lambda j:j[1]); ends=[j[1] for j in jobs]; dp=[0]\n    for i,(start,end,value) in enumerate(jobs):\n        dp.append(max(dp[-1],value+dp[bisect_right(ends,start,0,i)]))\n    return dp[-1]',
'def count_inversions(numbers):\n    ranks={x:i+1 for i,x in enumerate(sorted(set(numbers)))}\n    tree=[0]*(len(ranks)+1); total=0\n    for x in reversed(numbers):\n        i=ranks[x]-1\n        while i: total+=tree[i]; i-=i&-i\n        i=ranks[x]\n        while i<len(tree): tree[i]+=1; i+=i&-i\n    return total'
];
export const cppFull=[
'int height_range(vector<int> a){return a.empty()?0:*max_element(a.begin(),a.end())-*min_element(a.begin(),a.end());}',
'int count_bits(int n){int r=0;while(n){n&=n-1;r++;}return r;}',
'string compress_runs(string s){string r;for(int i=0;i<s.size();){int j=i+1;while(j<s.size()&&s[j]==s[i])j++;r+=s[i];r+=to_string(j-i);i=j;}return r;}',
'vector<int> sorted_squares(vector<int> a){vector<int> r(a.size());int l=0,h=(int)a.size()-1;for(int i=h;i>=0;i--){if(a[l]*a[l]>a[h]*a[h]){r[i]=a[l]*a[l];l++;}else{r[i]=a[h]*a[h];h--;}}return r;}',
'int gcd_all(vector<int> a){int r=0;for(int x:a)r=gcd(r,x);return r;}',
'vector<int> next_greater(vector<int> a){vector<int> r(a.size(),-1),s;for(int i=0;i<a.size();i++){while(!s.empty()&&a[s.back()]<a[i]){r[s.back()]=a[i];s.pop_back();}s.push_back(i);}return r;}',
'int min_platforms(vector<vector<int>> a){vector<pair<int,int>> events;for(auto x:a){events.push_back({x[0],1});events.push_back({x[1],-1});}sort(events.begin(),events.end());int r=0,n=0;for(auto [t,d]:events){n+=d;r=max(r,n);}return r;}',
'int kth_largest(vector<int> a,int k){priority_queue<int,vector<int>,greater<int>> q;for(int x:a){q.push(x);if(q.size()>k)q.pop();}return q.top();}',
'int components_count(int n,vector<vector<int>> e){vector<int> p(n);iota(p.begin(),p.end(),0);function<int(int)> f=[&](int x){return p[x]==x?x:p[x]=f(p[x]);};int r=n;for(auto x:e){int a=f(x[0]),b=f(x[1]);if(a!=b){p[a]=b;r--;}}return r;}',
'vector<int> spiral_order(vector<vector<int>> g){vector<int> r;if(g.empty())return r;int t=0,b=g.size()-1,l=0,h=g[0].size()-1;while(t<=b&&l<=h){for(int c=l;c<=h;c++)r.push_back(g[t][c]);t++;for(int x=t;x<=b;x++)r.push_back(g[x][h]);h--;if(t<=b){for(int c=h;c>=l;c--)r.push_back(g[b][c]);b--;}if(l<=h){for(int x=b;x>=t;x--)r.push_back(g[x][l]);l++;}}return r;}',
'vector<int> sliding_max(vector<int> a,int k){deque<int> q;vector<int> r;for(int i=0;i<a.size();i++){while(!q.empty()&&q.front()<=i-k)q.pop_front();while(!q.empty()&&a[q.back()]<=a[i])q.pop_back();q.push_back(i);if(i>=k-1)r.push_back(a[q.front()]);}return r;}',
'long long largest_rectangle(vector<int> a){a.push_back(0);vector<int> s;long long r=0;for(int i=0;i<a.size();i++){while(!s.empty()&&a[s.back()]>a[i]){int h=a[s.back()];s.pop_back();r=max(r,1LL*h*(i-(s.empty()?-1:s.back())-1));}s.push_back(i);}return r;}',
'long long mst_cost(int n,vector<vector<int>> e){sort(e.begin(),e.end(),[](auto a,auto b){return a[2]<b[2];});vector<int> p(n);iota(p.begin(),p.end(),0);function<int(int)> f=[&](int x){return p[x]==x?x:p[x]=f(p[x]);};long long r=0;int used=0;for(auto x:e){int a=f(x[0]),b=f(x[1]);if(a!=b){p[a]=b;used++;r+=x[2];}}return used==n-1?r:-1;}',
'long long max_flow(int n,vector<vector<int>> e,int source,int sink){vector<vector<long long>> c(n,vector<long long>(n));for(auto x:e)c[x[0]][x[1]]+=x[2];long long r=0;while(true){vector<int> p(n,-1);p[source]=source;queue<int> q;q.push(source);while(!q.empty()&&p[sink]<0){int v=q.front();q.pop();for(int u=0;u<n;u++)if(p[u]<0&&c[v][u]>0){p[u]=v;q.push(u);}}if(p[sink]<0)break;long long amount=LLONG_MAX;for(int v=sink;v!=source;v=p[v])amount=min(amount,c[p[v]][v]);for(int v=sink;v!=source;v=p[v]){c[p[v]][v]-=amount;c[v][p[v]]+=amount;}r+=amount;}return r;}',
'int palindrome_cuts(string s){int n=s.size();if(!n)return 0;vector<vector<bool>> p(n,vector<bool>(n));vector<int> d(n+1,n);d[0]=-1;for(int r=0;r<n;r++)for(int l=0;l<=r;l++)if(s[l]==s[r]&&(r-l<2||p[l+1][r-1])){p[l][r]=true;d[r+1]=min(d[r+1],d[l]+1);}return d[n];}'
];
