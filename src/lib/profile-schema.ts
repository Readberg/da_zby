import { z } from "./zod";
import { AVATAR_PATH_PATTERN } from "./avatar-file";
import { isCountryCode } from "./countries";

/** Shared by the API (server) and the forms (browser): one definition of a valid profile. */
export const NICKNAME_PATTERN = /^[A-Za-zА-Яа-яЁё0-9_]{3,20}$/;

export const nicknameSchema = z
  .string()
  .trim()
  .regex(NICKNAME_PATTERN, "3–20 символов: буквы, цифры и «_»");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    // Empty input means "clear the field".
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const profilePatchSchema = z
  .object({
    nickname: nicknameSchema,
    fullName: optionalText(100),
    contact: optionalText(200),
    about: optionalText(1000),
    countryCode: z.string().refine(isCountryCode, "Выберите страну из списка").nullable(),
    city: optionalText(100),
    /** Storage path of an already uploaded photo (`<user id>/<file>`), or null to remove it. */
    avatarPath: z.string().regex(AVATAR_PATH_PATTERN, "Некорректный путь к фото").nullable(),
    /** Fixed UTC offset in minutes, e.g. 180 = UTC+3. */
    utcOffsetMinutes: z.number().int().min(-720, "Не меньше UTC−12").max(840, "Не больше UTC+14"),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Нужно указать хотя бы одно поле");

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** Well-known places for each offset, shown next to it so nobody has to guess their zone. */
const UTC_REGIONS: Record<number, string> = {
  [-720]: "Бейкер",
  [-660]: "Паго-Паго",
  [-600]: "Гавайи",
  [-540]: "Аляска",
  [-480]: "Лос-Анджелес, Ванкувер",
  [-420]: "Денвер, Финикс",
  [-360]: "Чикаго, Мехико",
  [-300]: "Нью-Йорк, Торонто, Богота",
  [-240]: "Галифакс, Каракас",
  [-210]: "Ньюфаундленд",
  [-180]: "Буэнос-Айрес, Сан-Паулу",
  [-120]: "Южная Георгия",
  [-60]: "Азорские острова",
  0: "Лондон, Лиссабон, Рейкьявик",
  60: "Берлин, Париж, Варшава, Рим",
  120: "Киев, Рига, Вильнюс, Афины, Каир",
  180: "Минск, Москва, Стамбул",
  210: "Тегеран",
  240: "Ереван, Баку, Тбилиси, Дубай",
  270: "Кабул",
  300: "Астана, Ташкент, Карачи",
  330: "Дели, Мумбаи",
  345: "Катманду",
  360: "Бишкек, Дакка, Омск",
  390: "Янгон",
  420: "Бангкок, Джакарта",
  480: "Пекин, Сингапур, Перт",
  525: "Юкла",
  540: "Токио, Сеул",
  570: "Аделаида, Дарвин",
  600: "Сидней, Владивосток",
  630: "Лорд-Хау",
  660: "Нумеа, Магадан",
  690: "Норфолк",
  720: "Окленд, Фиджи",
  765: "Чатем",
  780: "Апиа",
  840: "Киритимати",
};

/** UTC offsets offered in the profile: every 30 minutes plus the three 45-minute zones. */
export function utcOffsetOptions(): { minutes: number; label: string }[] {
  const minutes = new Set<number>([345, 525, 765]);
  for (let m = -720; m <= 840; m += 30) minutes.add(m);
  return [...minutes]
    .sort((a, b) => a - b)
    .map((m) => {
      const region = UTC_REGIONS[m];
      return {
        minutes: m,
        label: region ? `${formatUtcOffset(m)} — ${region}` : formatUtcOffset(m),
      };
    });
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}
