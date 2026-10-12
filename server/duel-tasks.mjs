// Versioned duel statements; no hidden inputs or answers in this module.
const python=[
 ['count_even','Чёткий сигнал','Посчитай чётные числа в numbers. Ноль тоже чётный.','numbers','0 ≤ длина ≤ 200; целые числа от −1000 до 1000.','count_even([1, 2, 4, 7]) → 2'],
 ['digit_sum','Цифровой след','Верни сумму десятичных цифр числа n без учёта знака.','n','−10⁹ ≤ n ≤ 10⁹.','digit_sum(-204) → 6'],
 ['reverse_words','Обратный эфир','Разверни порядок слов в text. Любые пробельные символы разделяют слова; в ответе между словами один пробел.','text','ASCII, до 500 символов.','reverse_words("alpha  beta") → "beta alpha"'],
 ['running_totals','Набор высоты','Для каждой позиции верни сумму от начала numbers до этой позиции включительно.','numbers','0 ≤ длина ≤ 200; целые числа от −1000 до 1000.','running_totals([2, -1, 4]) → [2, 1, 5]'],
 ['longest_word','Длинный позывной','Верни самое длинное слово. При равенстве — первое. Для пустого списка верни пустую строку.','words','ASCII; до 100 слов, каждое до 30 символов.','longest_word(["ice", "summit", "rope"]) → "summit"']
];
const cpp=[
 ['height_range','Размах высот','Верни разность максимального и минимального элементов heights. Для пустого массива верни 0.','int height_range(vector<int> heights)','До 200 элементов; значения от −1000 до 1000.','height_range({4, 9, 2}) → 7'],
 ['count_bits','Биты маяка','Посчитай единичные биты неотрицательного числа n.','int count_bits(int n)','0 ≤ n ≤ 10⁹.','count_bits(13) → 3'],
 ['compress_runs','Сжатый сигнал','Замени каждую группу одинаковых соседних символов на символ и число повторений. Число 1 тоже записывай.','string compress_runs(string text)','ASCII-буквы, до 200 символов.','compress_runs("aaabbc") → "a3b2c1"'],
 ['sorted_squares','Квадраты склонов','Дан отсортированный по возрастанию массив numbers. Верни его квадраты, также отсортированные по возрастанию.','vector<int> sorted_squares(vector<int> numbers)','До 200 элементов; значения от −1000 до 1000.','sorted_squares({-3, -1, 2}) → {1, 4, 9}'],
 ['gcd_all','Общий шаг','Верни НОД всех элементов numbers. Для пустого массива верни 0.','int gcd_all(vector<int> numbers)','До 100 неотрицательных целых чисел, не больше 10⁶.','gcd_all({12, 18, 24}) → 6']
];
export const duelVersion='duel-v1';
export const cppPrelude='#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <numeric>\n#include <map>\n#include <set>\n#include <queue>\n#include <stack>\nusing namespace std;\n';
export function duelTask(language,level){
  const row=(language==='python'?python:language==='cpp'?cpp:[])[level];if(!row)return null;
  const [fn,title,description,signature,constraint,example]=row;
  return {id:duelVersion+':'+language+':'+level,fn,title,description,signature,constraint,example,starter:language==='python'?'def '+fn+'('+signature+'):\n    # Напиши решение\n    pass\n':cppPrelude+'\n'+signature+' {\n    // Напиши решение\n    return {};\n}\n'};
}
