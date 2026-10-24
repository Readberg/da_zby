// ISO 3166-1 alpha-2 codes; Russian names come from the platform's ICU data (Intl.DisplayNames),
// so the list never has to be translated by hand.
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

export const COUNTRY_CODES: readonly string[] = CODES.split(" ");

const names = new Intl.DisplayNames(["ru"], { type: "region" });

export function isCountryCode(value: string): boolean {
  return COUNTRY_CODES.includes(value);
}

export function countryName(code: string): string {
  return names.of(code) ?? code;
}

/** Countries sorted by Russian name, Belarus first (the audience of the channel). */
export function countryOptions(): { code: string; name: string }[] {
  const all = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );
  return [...all.filter((c) => c.code === "BY"), ...all.filter((c) => c.code !== "BY")];
}
