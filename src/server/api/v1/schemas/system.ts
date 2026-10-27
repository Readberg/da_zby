import { z } from "zod";

export const healthSchema = z.object({
  status: z.literal("ok").describe("The app is up and answering requests."),
  checks: z.object({
    database: z.enum(["ok", "error"]).describe("Whether the database answered a probe query."),
    telegramWebhook: z
      .enum(["ok", "error", "skipped"])
      .describe(
        "Whether the sign-in bot's webhook points at this site and delivers; skipped where the bot is not configured.",
      ),
  }),
});

export const versionSchema = z.object({
  version: z.string().describe("Application version from package.json."),
  apiVersions: z.array(z.string()).describe('Major API versions served right now, e.g. ["v1"].'),
  buildDate: z.string().nullable().describe("ISO 8601 build time in UTC."),
  commit: z
    .string()
    .nullable()
    .describe("Git commit of the running build; null when the host does not tell."),
});

/** The OpenAPI document itself (not wrapped in the `{ data, meta }` envelope). */
export const openApiDocumentSchema = z.record(z.string(), z.unknown());
