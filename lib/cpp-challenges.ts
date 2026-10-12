import { challenges, type Challenge, type TestCase } from './challenges';

const signatures = [
  'long long positive_sum(vector<int> numbers)', 'int find_missing(vector<int> numbers)',
  'bool is_palindrome(string text)', 'string first_unique(string text)', 'bool balanced(string text)',
  'vector<int> flatten(vector<Item> items)', 'int shortest_path(vector<vector<int>> grid)',
  'int count_islands(vector<vector<int>> grid)', 'vector<vector<int>> merge_intervals(vector<vector<int>> intervals)',
  'int leftmost(vector<int> numbers, int target)', 'int tree_depth(TreeNode* tree)',
  'long long shortest_route(int n, vector<vector<int>> edges, int start, int target)',
  'long long climb_ways(int n)', 'long long max_subarray(vector<int> numbers)', 'int summit(vector<int> heights)',
];
export const cppHeaders = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
#include <queue>
#include <stack>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <functional>
#include <cctype>
#include <climits>
#include <deque>
#include <tuple>
using namespace std;
`;
export const itemType = `struct Item {
    bool isInteger;
    int value = 0;
    vector<Item> items;
    Item(int v) : isInteger(true), value(v) {}
    Item(vector<Item> v) : isInteger(false), items(v) {}
};
`;
export const treeType = `struct TreeNode {
    int value;
    TreeNode *left, *right;
    TreeNode(int v, TreeNode* l = nullptr, TreeNode* r = nullptr)
        : value(v), left(l), right(r) {}
};
`;
const hints = [
  'Пройди vector циклом и прибавляй положительные элементы к long long.',
  'Сумма от 1 до N равна N * (N + 1) / 2. Вычти сумму элементов.',
  'Для этих задач строки ASCII. Используй isalnum и tolower с unsigned char, затем два указателя.',
  'Посчитай частоты через unordered_map<char, int>, затем снова пройди исходную строку.',
  'Используй stack<char> или vector<char> как стек.',
  'Если isInteger, добавь value. Иначе рекурсивно обработай items.',
  'Используй queue и матрицу расстояний. Посещай клетки по четырём направлениям.',
  'Обходи каждую ещё не посещённую клетку суши через DFS или BFS.',
  'sort упорядочит пары. Сравни начало текущего отрезка с концом последнего результата.',
  'Используй lower_bound или собственный бинарный поиск.',
  'Для nullptr верни 0, иначе 1 + max глубин left и right.',
  'priority_queue с greater и список смежности помогут реализовать Дейкстру.',
  'Храни два предыдущих значения в long long.',
  'Выбирай: продолжить участок или начать новый. Отдельно храни лучшую сумму.',
  'Поддерживай минимальные хвосты подпоследовательностей через lower_bound.',
];
export const cppChallenges: Challenge[] = challenges.map((c, i) => ({...c,
  signature:signatures[i], hint:hints[i],
  description:c.description.replaceAll('True', 'true').replaceAll('False','false').replaceAll('None','nullptr')
    + (i===5 ? ' В C++ элемент Item содержит isInteger, value и vector<Item> items; структура дана в шаблоне.' : '')
    + (i===10 ? ' В C++ дерево представлено TreeNode*: поля value, left, right. Структура дана в шаблоне.' : ''),
}));
export function cppStarter(c:Challenge) {
  return cppHeaders + '\n' + (c.id===6?itemType:c.id===11?treeType:'') + `\n${c.signature} {\n    // Напиши решение. main() добавляется автоматически.\n    return {};\n}\n`;
}
function literal(v:unknown):string {
  if(Array.isArray(v)) return '{'+v.map(literal).join(',')+'}';
  if(v===null) return 'nullptr';
  return JSON.stringify(v);
}
function item(v:unknown):string { return Array.isArray(v)?`Item(vector<Item>{${v.map(item).join(',')}})`:`Item(${v})`; }
function tree(v:unknown):string { if(v===null)return 'nullptr'; const a=v as unknown[];return `new TreeNode(${a[0]},${tree(a[1])},${tree(a[2])})`; }
const argTypes = [['vector<int>'],['vector<int>'],['string'],['string'],['string'],['vector<Item>'],['vector<vector<int>>'],['vector<vector<int>>'],['vector<vector<int>>'],['vector<int>','int'],['TreeNode*'],['int','vector<vector<int>>','int','int'],['int'],['vector<int>'],['vector<int>']];
export function cppProgram(code:string,c:Challenge,tests:TestCase[]) {
  const cases=tests.map((t,i)=>{
    const args=t.args.map((v,j)=>`${(c.cppArguments??argTypes[c.id-1])[j]} arg${j} = ${c.id===6?`{${(v as unknown[]).map(item).join(',')}}`:c.id===11?tree(v):literal(v)};`).join('\n');
    return `case ${i}: { ${args}\nauto answer = ${c.fn}(${t.args.map((_,j)=>`arg${j}`).join(',')}); cout << "\\nCLIMB_RESULT:"; climb_output(answer); cout << "\\n"; break; }`;
  }).join('\n');
  return code+String.raw`
// Test adapter: no access to the host filesystem or native processes.
#include <iomanip>
template<class T> void climb_output(const T& v) { cout << v; }
void climb_output(bool v) { cout << (v ? "true" : "false"); }
void climb_output(const string& s) {
    cout << '"';
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') cout << '\\' << c;
        else if (c < 32) cout << "\\u00" << hex << setw(2) << setfill('0') << int(c) << dec;
        else cout << c;
    }
    cout << '"';
}
template<class T> void climb_output(const vector<T>& v) {
    cout << '['; bool first = true;
    for (const auto& x : v) { if (!first) cout << ','; first=false; climb_output(x); }
    cout << ']';
}
int main() { int test; cin >> test; switch(test) {
`+cases+'\n} return 0; }\n';
}
