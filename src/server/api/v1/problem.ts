import { z } from "zod";

/** Stable machine-readable error codes of API v1. Never rename within a version. */
export const ERROR_CODES = {
  versionUnsupported: "api.version_unsupported",
  notFound: "api.not_found",
  validationFailed: "api.validation_failed",
  invalidJson: "api.invalid_json",
  internal: "api.internal_error",
  authRequired: "auth.required",
  forbidden: "auth.forbidden",
  videosUnavailable: "videos.unavailable",
  profileNotFound: "profile.not_found",
  nicknameTaken: "profile.nickname_taken",
  nicknameLocked: "profile.nickname_locked",
  tooManyRequests: "api.too_many_requests",
  loginUnavailable: "auth.telegram_unavailable",
  lastAdmin: "admin.last_admin",
  duplicate: "admin.duplicate",
  inUse: "admin.in_use",
  seasonClosed: "admin.season_closed",
  seasonState: "admin.season_state",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

/** RFC 9457 problem details, extended with `code`, `errors` and `requestId`. */
export const problemSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
  requestId: z.string(),
});

export type Problem = z.infer<typeof problemSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly title: string,
    readonly detail?: string,
    readonly errors?: FieldError[],
    readonly extra?: Record<string, unknown>,
  ) {
    super(detail ?? title);
    this.name = "ApiError";
  }
}

export function toProblem(error: ApiError, requestId: string, instance?: string): Problem {
  return {
    type: `urn:da-zby:problem:${error.code}`,
    title: error.title,
    status: error.status,
    ...(error.detail ? { detail: error.detail } : {}),
    ...(instance ? { instance } : {}),
    code: error.code,
    ...(error.errors ? { errors: error.errors } : {}),
    ...error.extra,
    requestId,
  };
}
