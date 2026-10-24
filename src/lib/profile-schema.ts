import { z } from "zod";
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
    /** Fixed UTC offset in minutes, e.g. 180 = UTC+3. */
    utcOffsetMinutes: z.number().int().min(-720, "Не меньше UTC−12").max(840, "Не больше UTC+14"),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Нужно указать хотя бы одно поле");

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** UTC offsets offered in the profile: every 30 minutes plus the three 45-minute zones. */
export function utcOffsetOptions(): { minutes: number; label: string }[] {
  const minutes = new Set<number>([345, 525, 765]);
  for (let m = -720; m <= 840; m += 30) minutes.add(m);
  return [...minutes].sort((a, b) => a - b).map((m) => ({ minutes: m, label: formatUtcOffset(m) }));
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}
