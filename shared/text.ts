// Невидимые символы, которыми в Telegram делают «пустые» имена (U+3164 и т. п.).
// Шрифты iOS рисуют их квадратиками, поэтому вырезаем.
const invisibleChars = /[­͏ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⠀ㅤ﻿ﾠ]/g;

export const cleanName = (value: string | undefined | null) =>
  (value ?? '').replace(invisibleChars, '').replace(/\s+/g, ' ').trim();
