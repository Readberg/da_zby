import type { Locale } from "./config";

/**
 * Validation messages come from the shared schemas (browser and API) in Russian. Forms show them in
 * the page's language through this table; an unknown message is shown as it is. A test feeds the
 * schemas with bad input and fails when a message has no English text.
 */
const EXACT: Record<string, string> = {
  "3–20 символов: буквы, цифры и «_»": "3–20 characters: letters, digits and “_”",
  "Выберите страну из списка": "Choose a country from the list",
  "Некорректный путь к фото": "Invalid photo path",
  "Не меньше UTC−12": "Not less than UTC−12",
  "Не больше UTC+14": "Not more than UTC+14",
  "Нужно указать хотя бы одно поле": "At least one field is required",
  "Фото должно быть загружено вами": "The photo must be uploaded by you",
  "Этот ник уже занят": "This nickname is already taken",
  "Матч не относится к этому туру": "The match does not belong to this round",
  "Целое число": "A whole number",
  "От 0": "From 0",
  "До 99": "Up to 99",
  "Некорректный id": "Invalid id",
  "Нечего сохранять": "Nothing to save",
  "Слишком много матчей": "Too many matches",
};

const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^Не длиннее (\d+) символов$/, (n) => `No longer than ${n} characters`],
];

export function localizeMessage(message: string, locale: Locale): string {
  if (locale === "ru") return message;
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return build(...match.slice(1));
  }
  return message;
}

/** True when the message has an English text (or is not Russian at all). */
export function hasEnglish(message: string): boolean {
  return localizeMessage(message, "en") !== message || !/[А-Яа-яЁё]/.test(message);
}
