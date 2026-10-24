import { NextRequest } from "next/server";
import { expect, vi } from "vitest";
import { problemSchema } from "@/server/api/v1/problem";

/** Fake Supabase server client: every query resolves with `queryResult`. */
export function fakeSupabase(
  queryResult: { error: unknown } = { error: null },
  auth: { user: unknown } = { user: null },
) {
  const chain = {
    select: () => chain,
    limit: () => chain,
    abortSignal: () => Promise.resolve(queryResult),
  };
  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => ({ data: false, error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: auth.user }, error: null })) },
  };
}

export function apiRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}

export function expectApiHeaders(response: Response) {
  expect(response.headers.get("API-Version")).toBe("1");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[\w-]+$/);
  expect(response.headers.get("Cache-Control")).toBeTruthy();
}

export async function expectProblem(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Content-Type")).toMatch(/^application\/problem\+json/);
  const body = problemSchema.parse(await response.json());
  expect(body.code).toBe(code);
  expect(body.status).toBe(status);
  expect(body.requestId).toBe(response.headers.get("X-Request-Id"));
  return body;
}
