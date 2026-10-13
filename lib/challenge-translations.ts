import type {Challenge} from './challenges';
import type {SiteLanguage} from './i18n';
import {difficultyLabels,type Difficulty} from './catalog';

type Copy={title:string;description:string;hint:string;constraint?:string};
const english:Record<number,Copy>={
  1:{title:'First Signal',description:'A sensor recorded changes in altitude. Return the sum of positive values in numbers. Ignore zero and negative values.',hint:'Start with total = 0. Add a number only when it is positive.'},
  2:{title:'Missing Number',description:'numbers contains distinct integers from 1 to N, with one missing. N is one greater than the list length. Find the missing number.',hint:'The sum from 1 to N is N * (N + 1) // 2.'},
  3:{title:'Mirror Code',description:'Determine whether text is a palindrome. Ignore case and all non-alphanumeric characters. Return a boolean. An empty cleaned string is a palindrome.',hint:'Keep only alphanumeric characters, convert to lowercase, then compare with the reverse.'},
  4:{title:'Unique Trace',description:'Return the first character in text that occurs exactly once. Case matters. Return an empty string if none exists.',hint:'Count frequencies first, then scan the original string in order.'},
  5:{title:'Anchor Point',description:'text contains only ()[]{} brackets. Check whether they are correctly nested and closed. Return a boolean.',hint:'Push opening brackets onto a stack. Each closing bracket must match the latest opening one.'},
  6:{title:'Canyon Echo',description:'The nested list items contains integers and other lists. Return a flat list of integers in their original order.',hint:'Recurse into lists and append integers to the result.',constraint:'Nesting depth ≤ 30'},
  7:{title:'Nearest Exit',description:'grid is a rectangular map: 0 is open and 1 is a wall. Find the minimum steps from the top-left to the bottom-right cell, moving in four directions. Return -1 if no path exists.',hint:'Use breadth-first search and mark a cell visited when adding it to the queue.',constraint:'1 ≤ rows and columns ≤ 50'},
  8:{title:'Archipelago',description:'Count islands in grid. 1 is land and 0 is water. Cells connect by sides, not diagonally.',hint:'Whenever you find unvisited land, traverse its entire island and increment the count.',constraint:'Grid size from 1 × 1 to 30 × 30'},
  9:{title:'Shared Route',description:'Merge overlapping intervals. Each interval is [start, end]. Touching intervals merge too. Return them sorted by start.',hint:'Sort by start, then extend the last merged interval whenever intervals overlap.'},
  10:{title:'Exact Bearing',description:'In sorted numbers, find the index of the leftmost occurrence of target. Indices start at zero. Return -1 if absent.',hint:'On a match, remember the index and keep searching the left half.'},
  11:{title:'Summit Roots',description:'A binary tree is represented by nested [value, left, right] lists; an empty subtree is null. Return its maximum depth. An empty tree has depth 0, one node has depth 1.',hint:'The depth of a nonempty tree is 1 + max(left depth, right depth).',constraint:'Up to 500 nodes; depth ≤ 100'},
  12:{title:'Transit Network',description:'An undirected graph has n vertices (0…n−1). Each edge is [a, b, weight] with positive weight. Return the shortest cost from start to target, or -1 if unreachable.',hint:'Track best distances and a min-priority queue. Add each edge in both directions.'},
  13:{title:'Steps',description:'There are n steps to the platform. Each move climbs 1 or 2 steps. Return the number of distinct move sequences. For n = 0, staying put counts as one way.',hint:'To reach step n, combine the ways to reach n−1 and n−2. Keep the last two values.'},
  14:{title:'Final Push',description:'Find the maximum sum of a nonempty contiguous subarray of numbers. All values may be negative.',hint:'At each position, choose whether to extend the current subarray or start a new one.'},
  15:{title:'Summit Protocol',description:'heights contains grip elevations. Find the length of the longest strictly increasing subsequence. You may skip elements but cannot reorder them.',hint:'Keep the smallest possible tail for each subsequence length and update it with binary search.'},
  101:{title:'Even Signal',description:'Count even values in numbers. Zero is even too.',hint:'Check the remainder after division by 2.'},
  102:{title:'Digital Trace',description:'Return the sum of the decimal digits of integer n. Ignore its minus sign.',hint:'Use abs(n), then extract digits with % 10.'},
  103:{title:'Reverse Transmission',description:'Reverse the order of words in text. Any whitespace separates words. Return words separated by one space, with no leading or trailing spaces.',hint:'split() removes extra whitespace; join() puts the words together.'},
  104:{title:'Gaining Altitude',description:'Return running sums of numbers: result[i] is the sum from the beginning through index i.',hint:'Add each value to a running total and store the total.',constraint:'0 ≤ len(numbers) ≤ 10,000; |element| ≤ 10⁶'},
  105:{title:'Longest Call Sign',description:'Return the longest word in words. Choose the first one on a tie. Return an empty string for an empty list.',hint:'Update the answer only when a word is strictly longer.',constraint:'Up to 1,000 ASCII words; word length ≤ 100'},
  106:{title:'Rotate the Map',description:'Rotate a square matrix grid 90 degrees clockwise. Return a new matrix.',hint:'Cell (r, c) moves to (c, n−1−r).',constraint:'1 ≤ matrix size ≤ 100'},
  107:{title:'Safety Margin',description:'For each item in numbers, return the product of all other items. Do not divide. For a single item, return [1].',hint:'Combine prefix and suffix products.',constraint:'1 ≤ length ≤ 100; |element| ≤ 10; result magnitude ≤ 10¹⁵'},
  108:{title:'Clear Frequency',description:'Find the length of the longest contiguous substring of text with no repeated characters. Case matters.',hint:'Track each character’s latest position and the left edge of a sliding window.',constraint:'ASCII; length ≤ 100,000'},
  109:{title:'Supply Exchange',description:'Given coin denominations and amount, with unlimited coins of each kind, return the minimum number of coins for the exact amount, or -1.',hint:'dp[s] is the fewest coins needed to make sum s.',constraint:'Positive denominations; 0 ≤ amount ≤ 10,000; up to 100 denominations'},
  110:{title:'Route Sums',description:'Count nonempty contiguous subarrays of numbers whose sum equals target. Values may be negative.',hint:'Store prefix-sum frequencies, starting with {0: 1}.',constraint:'Length ≤ 100,000; |element|, |target| ≤ 10⁶'},
  111:{title:'Protocol Repair',description:'Find the Levenshtein distance between a and b: the fewest single-character insertions, deletions, and substitutions. Each costs 1.',hint:'Build dp[i][j] from three neighboring states; two rows are enough.',constraint:'ASCII; each string length ≤ 500'},
  112:{title:'Intercept Window',description:'Return the shortest substring of text containing every character of pattern, including duplicates and case. On a tie, choose the leftmost. Return an empty string if none exists or pattern is empty.',hint:'Count missing characters and shrink the left edge once all are covered.',constraint:'ASCII; lengths ≤ 100,000'},
  113:{title:'Decode the Chain',description:'Count ways to split text into words from words. Words may repeat; duplicate dictionary entries do not create new ways. Return the count modulo 1,000,000,007. An empty text has one split.',hint:'dp[i] counts splits of the first i characters. Deduplicate words first.',constraint:'Lowercase Latin letters; text length ≤ 1,000; up to 100 nonempty words of length ≤ 20'},
  114:{title:'Expedition Plan',description:'Each job is [start, end, reward], with start < end. Choose non-overlapping jobs for the maximum total reward. A job may start exactly when the previous one ends. Choosing none is allowed.',hint:'Sort jobs by end time and use binary search for the last compatible job.',constraint:'Up to 100,000 jobs; 0 ≤ start < end ≤ 10⁹; 0 ≤ reward ≤ 10⁶'},
  115:{title:'Tangled Grips',description:'Count index pairs i < j for which numbers[i] > numbers[j]. Equal values are not inversions.',hint:'During merge sort, count how many left-side elements remain when taking a smaller right-side value.',constraint:'Length ≤ 100,000; |element| ≤ 10⁹; O(n log n) required'},
  116:{title:'Height Range',description:'Return the difference between the largest and smallest values in heights. Return 0 for an empty array.',hint:'Find the minimum and maximum in one pass.',constraint:'Up to 10,000 elements; |height| ≤ 10⁶'},
  117:{title:'Beacon Bits',description:'Return the number of set bits in the binary representation of nonnegative n.',hint:'Check the lowest bit, then shift the number right.'},
  118:{title:'Compressed Signal',description:'Replace each run of equal adjacent characters in text with the character and its count, even for a run of one. For example, aaabb → a3b2.',hint:'Count the current run and append its character and length.',constraint:'Lowercase Latin letters only; length ≤ 10,000'},
  119:{title:'Slope Squares',description:'numbers is sorted in nondecreasing order. Return a sorted array of the squares of its elements.',hint:'Compare absolute values at both ends, or sort the squares afterward.',constraint:'Up to 10,000 elements; |element| ≤ 10,000'},
  120:{title:'Common Step',description:'Return the greatest common divisor of all numbers. Values are nonnegative. Return 0 for an empty array or an array of zeroes.',hint:'Start with 0 and repeatedly apply std::gcd.',constraint:'Up to 10,000 elements; 0 ≤ element ≤ 10⁹'},
  121:{title:'Next Summit',description:'For each item in numbers, find the first strictly greater value to its right. Return those values, or -1 when none exists.',hint:'Keep indices without an answer in a stack.',constraint:'Length ≤ 100,000; elements from 0 to 10⁹'},
  122:{title:'Free Platform',description:'intervals contains occupied periods [arrival, departure), with arrival < departure. Find the minimum number of platforms needed. A platform becomes free at departure.',hint:'Sort events; departures must come before arrivals at the same time.',constraint:'Up to 100,000 intervals; times from 0 to 10⁹'},
  123:{title:'Grip Ranking',description:'Return the k-th largest element of numbers, counting duplicates separately. k = 1 means the maximum.',hint:'Use nth_element or a min-heap of size k.',constraint:'1 ≤ k ≤ length ≤ 100,000; |element| ≤ 10⁹'},
  124:{title:'Connected Stations',description:'An undirected graph has n vertices 0…n−1 and edges [a,b]. Return its number of connected components, including isolated vertices. Duplicate edges and self-loops are allowed.',hint:'Union components with DSU or traverse the graph.',constraint:'1 ≤ n ≤ 100,000; up to 200,000 edges'},
  125:{title:'Spiral Traverse',description:'Return elements of rectangular grid in a clockwise spiral, starting at the top-left and moving right.',hint:'Move the corresponding boundary inward after traversing each side.',constraint:'1 ≤ rows and columns ≤ 100'},
  126:{title:'Rope Maximum',description:'For each contiguous window of length k in numbers, return its maximum, with windows ordered left to right.',hint:'Keep useful indices in a deque, discarding expired and weaker ones.',constraint:'1 ≤ k ≤ length ≤ 100,000; O(n) required'},
  127:{title:'Record Plateau',description:'heights are widths-one histogram bars. Find the largest rectangle area inside the histogram. Return 0 for an empty array.',hint:'A stack of increasing heights finds each rectangle’s boundaries.',constraint:'Length ≤ 100,000; 0 ≤ height ≤ 10⁹; O(n) required'},
  128:{title:'Minimum Network',description:'An undirected graph has n vertices 0…n−1 and edges [a,b,weight]. Return the cost of its minimum spanning tree, or -1 if disconnected. One vertex costs 0.',hint:'Sort edges by weight and union distinct components with DSU.',constraint:'1 ≤ n ≤ 100,000; up to 200,000 edges; 0 ≤ weight ≤ 10⁹'},
  129:{title:'Network Capacity',description:'In a directed graph with n vertices 0…n−1, edges are [from,to,capacity]. Return maximum flow from source to sink. Parallel and reverse edges are allowed and counted separately.',hint:'Build a residual graph with reverse edges. Use Dinic or Edmonds–Karp.',constraint:'2 ≤ n ≤ 100; up to 1,000 edges; 0 ≤ capacity ≤ 10⁶; source ≠ sink'},
  130:{title:'Mirror Segments',description:'Find the fewest cuts of text so every resulting nonempty segment is a palindrome. Return 0 for an empty string. Case matters.',hint:'Precompute palindromic substrings, then the minimum cuts for each prefix.',constraint:'Lowercase Latin letters; length ≤ 1,000; O(n²) required'},
};

const topics:Record<string,string>={
  'УСЛОВИЯ':'CONDITIONS','ЦИКЛЫ':'LOOPS','СТРОКИ':'STRINGS','СПИСКИ':'LISTS','СЛОВАРИ':'DICTIONARIES','СТЕК':'STACK','РЕКУРСИЯ':'RECURSION',
  'ОЧЕРЕДЬ':'QUEUE','ОБХОД':'TRAVERSAL','СОРТИРОВКА':'SORTING','БИНАРНЫЙ ПОИСК':'BINARY SEARCH','ДЕРЕВЬЯ':'TREES',
  'ГРАФЫ':'GRAPHS','ДЕЙКСТРА':'DIJKSTRA','ДИНАМИЧЕСКОЕ ПРОГРАММИРОВАНИЕ':'DYNAMIC PROGRAMMING','ОПТИМИЗАЦИЯ':'OPTIMIZATION',
  'МАТРИЦЫ':'MATRICES','ПРЕФИКСЫ':'PREFIXES','СКОЛЬЗЯЩЕЕ ОКНО':'SLIDING WINDOW','ДИНАМИКА':'DYNAMIC PROGRAMMING',
  'ХЕШ-ТАБЛИЦЫ':'HASH MAPS','ДВА УКАЗАТЕЛЯ':'TWO POINTERS','СЛОВАРЬ':'DICTIONARY','СЛИЯНИЕ':'MERGE',
  'ПОДСЧЁТ':'COUNTING','МИНИМУМ':'MINIMUM','МАКСИМУМ':'MAXIMUM','БИТОВЫЕ ОПЕРАЦИИ':'BIT OPERATIONS',
  'МАССИВЫ':'ARRAYS','АРИФМЕТИКА':'ARITHMETIC','МОНОТОННЫЙ СТЕК':'MONOTONIC STACK','СОБЫТИЯ':'EVENTS',
  'КУЧА':'HEAP','ОТБОР':'SELECTION','МОНОТОННАЯ ОЧЕРЕДЬ':'MONOTONIC QUEUE','КРАСКАЛ':'KRUSKAL','ПОТОК':'FLOW',
  'ПАЛИНДРОМЫ':'PALINDROMES',
};

export function localizeChallenge(challenge:Challenge,language:SiteLanguage):Challenge{
  if(language==='ru')return challenge;
  const copy=english[challenge.id];if(!copy)return challenge;
  return {...challenge,title:copy.title,description:copy.description,hint:copy.hint,constraint:copy.constraint??challenge.constraint,
    topic:challenge.topic.split(' · ').map(part=>topics[part]??part).join(' · ')};
}

export const translatedChallengeCount=Object.keys(english).length;
const englishDifficulties:Record<Difficulty,string>={full:'Full ascent',easy:'Easy',medium:'Medium',hard:'Hard',classic:'Classic route'};
export const difficultyLabel=(difficulty:Difficulty,language:SiteLanguage)=>language==='en'?englishDifficulties[difficulty]:difficultyLabels[difficulty];

const duelEnglish:Record<string,{title:string;description:string;constraint:string}>={
  count_even:{title:'Even Signal',description:'Count even integers in numbers. Zero is even too.',constraint:'At most 200 integers between −1000 and 1000.'},
  digit_sum:{title:'Digital Trace',description:'Return the sum of the decimal digits of n, ignoring its sign.',constraint:'−10⁹ ≤ n ≤ 10⁹.'},
  reverse_words:{title:'Reverse Transmission',description:'Reverse the order of words in text. Any whitespace separates words; return words with one space between them.',constraint:'ASCII, up to 500 characters.'},
  running_totals:{title:'Gaining Altitude',description:'For each position, return the sum from the start of numbers through that position.',constraint:'At most 200 integers between −1000 and 1000.'},
  longest_word:{title:'Longest Call Sign',description:'Return the longest word. On a tie, choose the first. Return an empty string for an empty list.',constraint:'ASCII; at most 100 words of up to 30 characters.'},
  height_range:{title:'Altitude Range',description:'Return the difference between the largest and smallest elements of heights. Return 0 for an empty array.',constraint:'At most 200 elements between −1000 and 1000.'},
  count_bits:{title:'Beacon Bits',description:'Count the set bits in nonnegative integer n.',constraint:'0 ≤ n ≤ 10⁹.'},
  compress_runs:{title:'Compressed Signal',description:'Replace each run of identical neighboring characters with the character followed by its count. Include a count of 1.',constraint:'ASCII letters, up to 200 characters.'},
  sorted_squares:{title:'Slope Squares',description:'Given numbers sorted in ascending order, return their squares sorted in ascending order.',constraint:'At most 200 elements between −1000 and 1000.'},
  gcd_all:{title:'Common Step',description:'Return the greatest common divisor of all elements in numbers. Return 0 for an empty array.',constraint:'At most 100 nonnegative integers no greater than 10⁶.'},
};
export function localizeDuelTask<T extends {fn:string;title:string;description:string;constraint:string;starter:string}>(task:T,language:SiteLanguage):T{
  if(language==='ru'||!duelEnglish[task.fn])return task;
  return {...task,...duelEnglish[task.fn],starter:task.starter.replaceAll('Напиши решение','Write your solution')};
}
