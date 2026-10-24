/** Browser-side client of the internal API. The version is a single constant (docs/API.md). */
export const API_VERSION = "v1";

export type ApiProblem = {
  status: number;
  code: string;
  detail?: string;
  errors?: { field: string; message: string }[];
};

export class ApiClientError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(problem.detail ?? problem.code);
    this.name = "ApiClientError";
  }

  /** Message for one form field, if the server complained about it. */
  fieldError(field: string): string | undefined {
    return this.problem.errors?.find((e) => e.field === field)?.message;
  }
}

type Options = { method?: string; json?: unknown; signal?: AbortSignal };

/** Calls `/api/<version><path>` and returns `data`; throws ApiClientError for problem+json. */
export async function api<T>(
  path: string,
  { method = "GET", json, signal }: Options = {},
): Promise<T> {
  const response = await fetch(`/api/${API_VERSION}${path}`, {
    method,
    signal,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem =
      body && typeof body === "object" && "code" in body
        ? (body as ApiProblem)
        : { status: response.status, code: "api.unknown" };
    throw new ApiClientError(problem);
  }
  return (body as { data: T }).data;
}
