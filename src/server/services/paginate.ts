/** PostgREST answers at most this many rows per request (`max_rows` in supabase/config.toml). */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Reads every row of a query, page by page. A single request is cut off at `max_rows` without any
 * error, so a list that can outgrow it must be read this way. The query has to be ordered by a
 * unique column, otherwise rows can repeat or get lost between pages.
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
