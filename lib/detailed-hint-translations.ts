// Display-only translation. Unlocks and limits remain server-authoritative.
const classic=[
  'Start with zero. Add only positive numbers; an empty list returns zero.',
  'For N−1 numbers, subtract the input sum from the sum of 1 through N.',
  'Keep letters and digits, normalize case, and compare from both ends.',
  'Count character frequencies, then scan the original string in order.',
  'Push opening brackets; each closing bracket must match the top of the stack.',
  'Append numbers and recursively visit nested lists in their original order.',
  'Use breadth-first search and mark neighbors visited when enqueuing them.',
  'Each unvisited land cell starts a new island; traverse all connected land.',
  'Sort intervals by start; extend the last merged interval on overlap.',
  'Binary-search the first value at least equal to the target, then verify it.',
  'Depth is one plus the deeper child; an empty tree has depth zero.',
  'Use a min-priority queue of shortest known distances and skip stale entries.',
  'Ways to step n equal ways to n−1 plus ways to n−2; handle base cases.',
  'At each number, extend the prior segment or start anew; track the best.',
  'Keep minimum tails for increasing subsequence lengths, using binary search.'
];
const python=[
  'Count entries whose remainder modulo two is zero, including zero and negative even values.',
  'Remove the sign, then extract each decimal digit. Zero should still return zero.',
  'Split on all whitespace, reverse the words, then join with exactly one space.',
  'Keep a running total and append it to a new list after processing each input value.',
  'Update the best word only when a strictly longer one appears; handle an empty list.',
  'Map each cell (row, column) to (column, n−1−row) in a new matrix.',
  'Fill prefix products, then multiply each position by the product of all following values.',
  'Track previous character positions and move the window start past any repeated character.',
  'Let dp[s] be the fewest coins for sum s; try every usable denomination for each sum.',
  'Keep frequencies of prefix sums, initially one occurrence of zero. At each position, count prior prefixes differing by target.',
  'For edit distance, derive each cell from insertion, deletion and substitution neighbors; two rows suffice.',
  'Track missing pattern characters while expanding the window. Once complete, shrink from the left and record the shortest.',
  'Deduplicate dictionary words. Let dp[i] count ways to split the first i characters, applying the modulus.',
  'Sort jobs by end time. Binary-search the last compatible job and compare taking versus skipping each job.',
  'Count inversions during merge sort: taking a smaller right element skips all left elements still remaining.'
];
const cpp=[
  'Track the minimum and maximum in one pass; an empty vector returns zero.',
  'Inspect the low bit, then shift right, or clear the lowest set bit repeatedly.',
  'Scan equal neighboring characters as one run. Append its character and count, including one.',
  'Compare absolute values at both ends; put the larger square at the back of the result.',
  'Start the gcd at zero and fold std::gcd over all numbers.',
  'Keep indices without answers in a stack. A new larger value resolves the smaller values on top.',
  'Sort arrival and departure events; departures free a platform before arrivals at the same time.',
  'Keep a min-heap of at most k values. At the end, its minimum is the kth largest.',
  'Use DSU: each vertex starts alone. Union edge endpoints and reduce the component count only on a real merge.',
  'Track top, bottom, left and right bounds. Traverse each side, then move its bound inward.',
  'Use a deque of candidate indices. Remove expired indices from the front and weaker candidates from the back.',
  'Keep an increasing stack of bar indices. On a lower height, pop bars and calculate rectangle areas.',
  'Sort edges by weight and add only those connecting different components. Check that n−1 edges were selected.',
  'Keep residual capacities. Find an augmenting path, push its bottleneck flow, and update forward and reverse edges.',
  'Precompute palindromic substrings. For every prefix, choose the fewest cuts ending in a palindrome.'
];
export function englishDetailedHint(language:'python'|'cpp',id:number):string|null{
  if(id>=1&&id<=15)return classic[id-1];
  const start=language==='python'?101:116;
  return id>=start&&id<start+15?(language==='python'?python:cpp)[id-start]??null:null;
}
