/**
 * Where the schedule and results of the league come from (D-090): TheSportsDB, queried only when
 * an admin presses the import button in a tour. Round N of the league is tour N of the season.
 */
export const FIXTURES_SOURCE = {
  name: "TheSportsDB",
  baseUrl: "https://www.thesportsdb.com/api/v1/json",
  /** "Belarus Vyscha Liga" on TheSportsDB. */
  leagueId: "4622",
  /** The free test key of the service; a paid key can be set in THESPORTSDB_API_KEY. */
  defaultKey: "123",
} as const;

/**
 * The source's English club names → the names of our catalogue. A club of the source that is not
 * here (or whose catalogue name does not exist yet) is shown as "not found" in the preview.
 */
export const CLUB_ALIASES: Readonly<Record<string, string>> = {
  "Arsenal Dzerzhinsk": "Арсенал",
  "BATE Borisov": "БАТЭ",
  Baranovichi: "Барановичи",
  "Belshina Bobruisk": "Белшина",
  "Dinamo Minsk": "Динамо Минск",
  "Dnepr Mogilev": "Днепр",
  "Dynamo Brest": "Динамо Брест",
  Gomel: "Гомель",
  "Isloch Minsk Raion": "Ислочь",
  "Maxline Vitebsk": "МЛ Витебск",
  Minsk: "Минск",
  "Naftan Novopolotsk": "Нафтан",
  "Neman Grodno": "Неман",
  "Slavia Mozyr": "Славия",
  "Torpedo-BelAZ Zhodino": "Торпедо-БелАЗ",
  Vitebsk: "Витебск",
};
