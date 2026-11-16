import { z } from "zod";
import { ACTION_KEYS } from "@/server/admin/permissions";

export const consoleListQuerySchema = z.object({
  entity: z.string().min(1).max(40),
  q: z.string().trim().max(100).optional().describe("Text search over the searchable fields."),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  /** Filters as `field:value` pairs joined by `;`, e.g. `status:sold;is_bot:true`. */
  filters: z.string().max(300).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ConsoleListQuery = z.infer<typeof consoleListQuerySchema>;

export const consoleRowSchema = z.record(z.string(), z.unknown());
export const consoleListSchema = z.object({
  items: z.array(consoleRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ConsoleList = z.infer<typeof consoleListSchema>;

export const consoleRecordQuerySchema = z.object({
  entity: z.string().min(1).max(40),
  id: z.string().min(1).max(64),
});
export const consoleRecordSchema = z.object({ record: consoleRowSchema });

export const consoleEditBodySchema = z.object({
  entity: z.string().min(1).max(40),
  id: z.uuid(),
  patch: z
    .record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]))
    .describe("Database column names and new values; the role of the caller is checked per field."),
  reason: z.string().trim().min(5).max(300),
});
export type ConsoleEditBody = z.infer<typeof consoleEditBodySchema>;

export const consoleChangeSchema = z.object({
  before: z.record(z.string(), z.unknown()),
  after: z.record(z.string(), z.unknown()),
});

export const consoleActionBodySchema = z.object({
  action: z.enum(ACTION_KEYS),
  targets: z.array(z.string().min(1).max(64)).min(1).max(50),
  reason: z.string().trim().min(5).max(300),
  params: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
});
export type ConsoleActionBody = z.infer<typeof consoleActionBodySchema>;

export const consoleActionResultSchema = z.object({
  results: z.array(z.object({ target: z.string(), ok: z.boolean(), error: z.string().optional() })),
});
export type ConsoleActionResult = z.infer<typeof consoleActionResultSchema>;

export const suspiciousItemSchema = z.object({
  kind: z.string(),
  subject: z.string(),
  clubIds: z.array(z.string()),
  score: z.number().int(),
  details: z.record(z.string(), z.unknown()),
  reviewedAt: z.string().nullable(),
  clubs: z.array(z.object({ id: z.string(), name: z.string() })),
});
export const suspiciousListSchema = z.object({ items: z.array(suspiciousItemSchema) });
export type SuspiciousItem = z.infer<typeof suspiciousItemSchema>;

export const suspiciousReviewBodySchema = z.object({
  kind: z.string().min(1).max(40),
  subject: z.string().min(1).max(100),
  note: z.string().trim().max(300).optional(),
});
export const suspiciousReviewedSchema = z.object({ ok: z.literal(true) });
