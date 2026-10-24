import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { EndpointDef } from "./endpoint";
import { jsonResponse, problemResponse, resolveRequestId } from "./http";
import { ApiError, ERROR_CODES, type FieldError } from "./problem";

export type ApiContext<Query> = {
  request: NextRequest;
  requestId: string;
  query: Query;
  supabase: SupabaseClient<Database>;
  /** Present for `user` and `admin` endpoints. */
  user: User | null;
};

export type HandlerResult<Data> = { data: Data; meta?: Record<string, unknown> };

function issuesToFieldErrors(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

async function authenticate(
  level: EndpointDef["auth"],
  request: NextRequest,
  supabase: SupabaseClient<Database>,
): Promise<User | null> {
  if (level === "public") return null;

  // Browsers use the session cookie; external clients send `Authorization: Bearer <access token>`.
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(
      401,
      ERROR_CODES.authRequired,
      "Unauthorized",
      "Sign in to use this endpoint.",
    );
  }

  if (level === "admin") {
    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
    if (rpcError || !isAdmin) {
      throw new ApiError(403, ERROR_CODES.forbidden, "Forbidden", "Admin role required.");
    }
  }

  return data.user;
}

/**
 * Wraps a route handler of API v1: request id and version headers, auth level, query validation,
 * output contract check, `{ data, meta }` envelope and problem+json errors.
 * Business logic stays in `src/server/services`.
 */
export function withApi<Query extends z.ZodObject, Output extends z.ZodType>(
  endpoint: EndpointDef<Query, Output>,
  handler: (ctx: ApiContext<z.infer<Query>>) => Promise<HandlerResult<z.infer<Output>>>,
) {
  return async function route(request: NextRequest): Promise<Response> {
    const requestId = resolveRequestId(request.headers);
    const instance = new URL(request.url).pathname;

    try {
      let query = {} as z.infer<Query>;
      if (endpoint.query) {
        const parsed = endpoint.query.safeParse(
          Object.fromEntries(new URL(request.url).searchParams),
        );
        if (!parsed.success) {
          throw new ApiError(
            422,
            ERROR_CODES.validationFailed,
            "Unprocessable Content",
            "Request parameters are invalid.",
            issuesToFieldErrors(parsed.error.issues),
          );
        }
        query = parsed.data;
      }

      const supabase = await createClient();
      const user = await authenticate(endpoint.auth, request, supabase);
      const result = await handler({ request, requestId, query, supabase, user });

      // The handler must honour the published contract; a mismatch is a server bug, not a client error.
      const data = endpoint.output.parse(result.data);
      return jsonResponse(
        { data, meta: result.meta ?? {} },
        { requestId, cacheControl: endpoint.cacheControl },
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return problemResponse(error, requestId, instance);
      }
      console.error(`[api] ${request.method} ${instance} failed (requestId=${requestId})`, error);
      return problemResponse(
        new ApiError(500, ERROR_CODES.internal, "Internal Server Error", "Unexpected error."),
        requestId,
        instance,
      );
    }
  };
}
