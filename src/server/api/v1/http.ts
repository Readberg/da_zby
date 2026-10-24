import { API_VERSION } from "./constants";
import { ApiError, ERROR_CODES, toProblem } from "./problem";

const REQUEST_ID_PATTERN = /^[\w-]{1,128}$/;

/** Reuses a sane incoming `X-Request-Id` (e.g. from a proxy) or generates a new one. */
export function resolveRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
}

function baseHeaders(requestId: string, cacheControl: string): Headers {
  return new Headers({
    "X-Request-Id": requestId,
    "API-Version": API_VERSION,
    "Cache-Control": cacheControl,
  });
}

export function jsonResponse(
  body: unknown,
  {
    status = 200,
    requestId,
    cacheControl,
  }: { status?: number; requestId: string; cacheControl: string },
): Response {
  const headers = baseHeaders(requestId, cacheControl);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function problemResponse(error: ApiError, requestId: string, instance?: string): Response {
  const headers = baseHeaders(requestId, "no-store");
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  return new Response(JSON.stringify(toProblem(error, requestId, instance)), {
    status: error.status,
    headers,
  });
}

export function notFoundError(path: string): ApiError {
  return new ApiError(404, ERROR_CODES.notFound, "Not Found", `No API resource at ${path}.`);
}
