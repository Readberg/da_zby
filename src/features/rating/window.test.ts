import { describe, expect, it } from "vitest";
import { NEIGHBOURS, TOP_ROWS, windowRows } from "./window";

const table = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i + 1}` }));
const ids = (rows: { userId: string }[]) => rows.map((row) => row.userId);

describe("windowRows", () => {
  it("shows a short table whole", () => {
    const view = windowRows(table(5), "u3", false);
    expect(view.rows).toHaveLength(5);
    expect(view.gapBefore).toEqual({});
    expect(view.gapAfter).toBe(0);
    expect(view.canExpand).toBe(false);
  });

  it("cuts a guest's view to the top", () => {
    const view = windowRows(table(50), null, false);
    expect(ids(view.rows)).toEqual(ids(table(TOP_ROWS)));
    expect(view.gapAfter).toBe(30);
    expect(view.canExpand).toBe(false);
  });

  it("adds the viewer's own row after a gap when outside the top", () => {
    const view = windowRows(table(100), "u50", false);
    expect(ids(view.rows)).toEqual([...ids(table(TOP_ROWS)), "u50"]);
    expect(view.gapBefore).toEqual({ u50: 29 });
    expect(view.gapAfter).toBe(50);
    expect(view.canExpand).toBe(true);
  });

  it("adds five rows each side of the viewer when expanded", () => {
    const view = windowRows(table(100), "u50", true);
    expect(ids(view.rows).slice(TOP_ROWS)).toEqual(
      Array.from({ length: NEIGHBOURS * 2 + 1 }, (_, i) => `u${50 - NEIGHBOURS + i}`),
    );
    expect(view.gapBefore).toEqual({ u45: 24 });
    expect(view.gapAfter).toBe(45);
    expect(view.canExpand).toBe(false);
  });

  it("has no gap when the viewer sits right after the top, but still offers the rows below", () => {
    const view = windowRows(table(100), "u21", false);
    expect(view.gapBefore).toEqual({});
    expect(ids(view.rows)).toHaveLength(TOP_ROWS + 1);
    expect(view.canExpand).toBe(true);
  });

  it("offers nothing extra to a viewer inside the top whose neighbours are all shown", () => {
    const view = windowRows(table(100), "u10", false);
    expect(view.canExpand).toBe(false);
    expect(view.rows).toHaveLength(TOP_ROWS);
  });

  it("joins the top and the neighbours when they touch", () => {
    const view = windowRows(table(100), "u24", true);
    expect(view.gapBefore).toEqual({});
    expect(ids(view.rows)).toHaveLength(29);
  });

  it("handles a viewer who is last", () => {
    const view = windowRows(table(100), "u100", true);
    expect(ids(view.rows).at(-1)).toBe("u100");
    expect(view.gapAfter).toBe(0);
  });

  it("ignores a viewer who is not in the table", () => {
    const view = windowRows(table(30), "nobody", false);
    expect(view.rows).toHaveLength(TOP_ROWS);
    expect(view.canExpand).toBe(false);
  });
});
