import { z } from "zod";
import { profilePatchSchema } from "@/lib/profile-schema";

export const adminUserSchema = z.object({
  id: z.string().describe("User id (UUID)."),
  nickname: z.string().nullable().describe("Null until onboarding is completed."),
  fullName: z.string().nullable(),
  role: z.enum(["user", "admin"]),
  createdAt: z.string().describe("ISO 8601, UTC."),
  lastLoginAt: z.string().nullable().describe("ISO 8601, UTC."),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe("Part of a nickname or a full name (case-insensitive)."),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminUsersSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int().describe("All users matching the search."),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminUsers = z.infer<typeof adminUsersSchema>;

export const adminUserRoleBodySchema = z.object({
  userId: z.uuid(),
  role: z.enum(["user", "admin"]),
});
export type AdminUserRoleBody = z.infer<typeof adminUserRoleBodySchema>;

export const adminUserRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(["user", "admin"]),
});

export const adminUserProfileBodySchema = z.object({
  userId: z.uuid(),
  patch: profilePatchSchema.describe(
    "The same fields as PATCH /me; `avatarPath` may only be null (remove the photo).",
  ),
});
export type AdminUserProfileBody = z.infer<typeof adminUserProfileBodySchema>;

export const adminUserProfileSchema = z.object({
  userId: z.string(),
  nickname: z.string().nullable(),
  fullName: z.string().nullable(),
  contact: z.string().nullable(),
  about: z.string().nullable(),
  countryCode: z.string().nullable(),
  city: z.string().nullable(),
  utcOffsetMinutes: z.number().int(),
  avatarUrl: z.string().nullable(),
});
export type AdminUserProfile = z.infer<typeof adminUserProfileSchema>;
