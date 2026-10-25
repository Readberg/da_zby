import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOptimisticList } from "./use-optimistic-list";

const item = (id: string, name = id) => ({ id, name });

describe("useOptimisticList", () => {
  it("shows an added item at once, at the end by default", () => {
    const { result } = renderHook(() => useOptimisticList([item("a"), item("b")]));
    act(() => result.current.add(item("c")));
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(result.current.isNew("c")).toBe(true);
    expect(result.current.isNew("a")).toBe(false);
  });

  it("can put new items first or sort them", () => {
    const first = renderHook(() => useOptimisticList([item("a")], "start"));
    act(() => first.result.current.add(item("z")));
    expect(first.result.current.items.map((i) => i.id)).toEqual(["z", "a"]);

    const sorted = renderHook(() =>
      useOptimisticList([item("b", "Б"), item("d", "Г")], (x, y) =>
        x.name.localeCompare(y.name, "ru"),
      ),
    );
    act(() => sorted.result.current.add(item("c", "В")));
    expect(sorted.result.current.items.map((i) => i.name)).toEqual(["Б", "В", "Г"]);
  });

  it("lets the server row take over once it arrives, without duplicates", () => {
    const { result, rerender } = renderHook(({ server }) => useOptimisticList(server), {
      initialProps: { server: [item("a")] },
    });
    act(() => result.current.add(item("b", "local")));
    expect(result.current.items).toHaveLength(2);

    rerender({ server: [item("a"), item("b", "from server")] });
    expect(result.current.items.map((i) => i.name)).toEqual(["a", "from server"]);
    expect(result.current.isNew("b")).toBe(false);
  });

  it("hides a removed item at once and keeps it hidden after the refresh", () => {
    const { result, rerender } = renderHook(({ server }) => useOptimisticList(server), {
      initialProps: { server: [item("a"), item("b")] },
    });
    act(() => result.current.remove("a"));
    expect(result.current.items.map((i) => i.id)).toEqual(["b"]);
    rerender({ server: [item("b")] });
    expect(result.current.items.map((i) => i.id)).toEqual(["b"]);
  });
});
