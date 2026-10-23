// Проверка адреса доставки — общая для мини-аппа и сервера.
// Возвращает понятную подсказку или пустую строку, если адрес похож на настоящий.

const keyboardRows = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const keyboardRuns = keyboardRows.flatMap((row) => [row, [...row].reverse().join('')]);
const vowels = /[аеиоуыэюяaeiouy]/;
const consonantRun = /[бвгджзйклмнпрстфхцчшщ]{5,}|[bcdfghjklmnpqrstvwxz]{5,}/;
const allowedChars = /^[\p{Script=Cyrillic}a-z0-9\s,.\-/№()'":;]+$/iu;

export const normalizeAddress = (value: string) => value.replace(/\s+/g, ' ').trim();

const hasKeyboardRun = (word: string) => {
  for (let start = 0; start + 5 <= word.length; start += 1) {
    const chunk = word.slice(start, start + 5);
    if (keyboardRuns.some((row) => row.includes(chunk))) return true;
  }
  return false;
};

// Слово похоже на случайный набор букв
const isGibberishWord = (raw: string) => {
  const word = raw.toLowerCase().replace(/ё/g, 'е');
  if (word.length > 25) return true;
  if (/(.)\1{3}/.test(word) || /(..+)\1{2,}/.test(word)) return true;
  if (word.length >= 4 && !vowels.test(word)) return true;
  if (consonantRun.test(word)) return true;
  return hasKeyboardRun(word);
};

// Номер дома: 8, 12а, 15/2, 7к1, 3-1, «д. 5», «дом 5»
const houseNumber = /(^|[\s,.])(д\.?|дом)?\s*\d{1,4}(\s?[а-яa-z]|[/-]\d{1,4}[а-яa-z]?|\s?к\.?\s?\d{1,2})?\.?(?=$|[\s,.;])/i;

export const getAddressError = (value: string) => {
  const address = normalizeAddress(value);

  if (address.length < 8) return 'Укажите улицу и номер дома.';
  if (address.length > 200) return 'Адрес слишком длинный — оставьте улицу, дом и квартиру.';
  // 6 цифр — почтовый индекс, 7 и больше — уже телефон
  if (/\d{7,}/.test(address.replace(/[\s()+-]/g, ''))) return 'Похоже на номер телефона — укажите адрес.';
  if (!allowedChars.test(address)) return 'Уберите из адреса лишние символы.';
  // Латиница и кириллица вперемешку в одном слове — ошибка раскладки или мусор
  if (/[a-z][а-яё]|[а-яё][a-z]/i.test(address)) return 'Проверьте раскладку: смешаны русские и латинские буквы.';

  const words = address.match(/\p{Script=Cyrillic}+|[a-z]+/giu) ?? [];
  if (!words.some((word) => word.length >= 3)) return 'Укажите название улицы.';
  if (words.some(isGibberishWord)) return 'Похоже на случайный набор букв — проверьте адрес.';
  if (!houseNumber.test(address)) return 'Добавьте номер дома.';

  return '';
};
