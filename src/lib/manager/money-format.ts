/** "12 345" in Russian, "12,345" in English: the thousands are separated the way the reader expects. */
export function formatNumber(value: number, locale: string): string {
  return Math.round(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
}

/** A sum of game dollars with the template of the language ("{n} $"). */
export function formatMoney(value: number, locale: string, template: string): string {
  return template.replace("{n}", formatNumber(value, locale));
}
