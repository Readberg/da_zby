import { vi } from "vitest";

type TableScript = {
  /** Rows every read of the table returns (single-row reads take the first). */
  data?: unknown[];
  count?: number;
  error?: { code?: string; message: string } | null;
};

/**
 * Table-driven stand-in for the Supabase client in service tests: each `from(table)` resolves with
 * the scripted rows, and every call on the query chain is recorded per table.
 */
export function fakeDb(
  tables: Record<string, TableScript>,
  rpc: Record<string, { data?: unknown; error?: { code?: string; message: string } | null }> = {},
) {
  const calls: Record<string, { method: string; args: unknown[] }[]> = {};

  function chainFor(table: string) {
    const script = tables[table] ?? {};
    let single = false;
    const log = (method: string, args: unknown[]) => {
      (calls[table] ??= []).push({ method, args });
    };
    const chain: Record<string, unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "in",
      "or",
      "order",
      "limit",
    ]) {
      chain[method] = (...args: unknown[]) => {
        log(method, args);
        return chain;
      };
    }
    for (const method of ["single", "maybeSingle"]) {
      chain[method] = (...args: unknown[]) => {
        log(method, args);
        single = true;
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => unknown) => {
      const rows = script.data ?? [];
      return Promise.resolve({
        data: single ? (rows[0] ?? null) : rows,
        count: script.count ?? rows.length,
        error: script.error ?? null,
      }).then(resolve);
    };
    return chain;
  }

  const rpcMock = vi.fn(async (name: string) => ({
    data: rpc[name]?.data ?? null,
    error: rpc[name]?.error ?? null,
  }));
  return {
    db: { from: vi.fn((table: string) => chainFor(table)), rpc: rpcMock } as never,
    calls,
    rpc: rpcMock,
    payload: (table: string, method: string) =>
      calls[table]?.find((c) => c.method === method)?.args[0],
  };
}
