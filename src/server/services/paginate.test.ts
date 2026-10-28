import { describe, expect, it } from "vitest";
import { PAGE_SIZE, fetchAll } from "./paginate";

function source(total: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const data = Array.from(
      { length: Math.max(0, Math.min(to + 1, total) - from) },
      (_, i) => from + i,
    );
    return { data, error: null };
  };
  return { page, calls };
}

describe("fetchAll", () => {
  it("reads past the single-request cap", async () => {
    const { page, calls } = source(2500);
    const rows = await fetchAll(page);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toBe(2499);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("makes one request for a short list", async () => {
    const { page, calls } = source(3);
    expect(await fetchAll(page)).toEqual([0, 1, 2]);
    expect(calls).toHaveLength(1);
  });

  it("asks once more after an exactly full page and stops on the empty one", async () => {
    const { page, calls } = source(PAGE_SIZE);
    expect(await fetchAll(page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("throws the database error", async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: { message: "boom" } })),
    ).rejects.toEqual({
      message: "boom",
    });
  });
});
