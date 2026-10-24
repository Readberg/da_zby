import { z } from "zod";

export const profileMeSchema = z.object({
  id: z.string().describe("User id (UUID)."),
  nickname: z.string().nullable().describe("Null until onboarding is completed."),
  fullName: z.string().nullable(),
  contact: z.string().nullable().describe("Public contact (Telegram, Instagram…)."),
  about: z.string().nullable(),
  avatarUrl: z.url().nullable().describe("Public URL of the photo."),
  countryCode: z.string().nullable().describe("ISO 3166-1 alpha-2."),
  city: z.string().nullable(),
  utcOffsetMinutes: z.number().int().describe("Display time zone as a fixed UTC offset."),
  role: z.enum(["user", "admin"]),
  email: z.string().nullable().describe("Visible only to the owner of the profile."),
  createdAt: z.string().describe("ISO 8601, UTC."),
  lastLoginAt: z.string().nullable().describe("ISO 8601, UTC."),
});

export type ProfileMe = z.infer<typeof profileMeSchema>;

export const nicknameAvailabilityQuerySchema = z.object({
  nickname: z.string().trim().max(100).describe("Nickname to check (case-insensitive)."),
});

export const nicknameAvailabilitySchema = z.object({
  valid: z.boolean().describe("Matches the nickname rules (3–20 letters, digits, _)."),
  available: z.boolean().describe("Valid and not taken by anyone."),
});
