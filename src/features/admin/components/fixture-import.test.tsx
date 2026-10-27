import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FixturesPreview } from "@/server/api/v1/schemas/admin-fixtures";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { FixtureImport, describeChange } = await import("./fixture-import");
const { ApiClientError } = await import("@/lib/api-client");

const TOUR = "44444444-4444-4444-8444-444444444444";

const scheduled = (kickoffAt: string) => ({
  kickoffAt,
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
});

const row = (over: Partial<FixturesPreview["rows"][number]>): FixturesPreview["rows"][number] => ({
  key: "A|B",
  fixture: {
    home: "A",
    away: "B",
    kickoffAt: "2026-10-30T15:00:00.000Z",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  },
  homeName: "Динамо Минск",
  awayName: "БАТЭ",
  action: "create",
  current: null,
  next: scheduled("2026-10-30T15:00:00.000Z"),
  matchId: null,
  notes: [],
  ...over,
});

const preview = (rows: FixturesPreview["rows"], extra: FixturesPreview["extra"] = []) => ({
  source: "TheSportsDB",
  season: "2026",
  round: 3,
  rows,
  extra,
});

function setup() {
  render(<FixtureImport tourId={TOUR} tourNumber={3} offsetMinutes={180} />);
}

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

describe("describeChange", () => {
  it("describes a new match by its time in the admin's zone", () => {
    expect(describeChange(row({}), 180)).toEqual(["30 октября в 18:00"]);
  });

  it("names only what differs for an update", () => {
    const moved = row({
      action: "update",
      matchId: "m1",
      current: scheduled("2026-10-30T15:00:00.000Z"),
      next: scheduled("2026-10-31T15:00:00.000Z"),
    });
    expect(describeChange(moved, 180)).toEqual(["время 30 октября в 18:00 → 31 октября в 18:00"]);

    const result = row({
      action: "update",
      matchId: "m1",
      current: scheduled("2026-10-30T15:00:00.000Z"),
      next: {
        ...scheduled("2026-10-30T15:00:00.000Z"),
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      },
    });
    expect(describeChange(result, 180)).toEqual([
      "статус: запланирован → завершён",
      "счёт нет → 2:1",
    ]);
  });
});

describe("FixtureImport", () => {
  it("starts with the tour's number as the round and asks the source only on a click", async () => {
    api.mockResolvedValue(preview([]));
    setup();
    expect(screen.getByLabelText("Тур лиги")).toHaveValue("3");
    expect(api).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Показать, что изменится" }));
    expect(api).toHaveBeenCalledWith(`/admin/fixtures?tourId=${TOUR}&round=3`);
    expect(await screen.findByText("В источнике для этого тура матчей нет.")).toBeVisible();
  });

  it("shows each match with what will happen and ticks the ones that can be applied", async () => {
    api.mockResolvedValue(
      preview(
        [
          row({}),
          row({ key: "C|D", action: "same", homeName: "Минск", awayName: "Гомель", next: null }),
          row({
            key: "E|F",
            action: "blocked",
            homeName: null,
            awayName: "Неман",
            next: null,
            notes: ["Клуб «E» не найден в справочнике"],
            fixture: {
              home: "E",
              away: "F",
              kickoffAt: "2026-10-30T15:00:00.000Z",
              status: "scheduled",
              homeScore: null,
              awayScore: null,
            },
          }),
        ],
        [{ matchId: "m9", homeName: "Славия", awayName: "Витебск" }],
      ),
    );
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Показать, что изменится" }));

    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).toBeDisabled();
    expect(boxes[2]).toBeDisabled();
    expect(screen.getByText(/Новый матч/)).toBeVisible();
    expect(screen.getByText("Клуб «E» не найден в справочнике")).toBeVisible();
    expect(screen.getByText("Славия — Витебск")).toBeVisible();
    expect(screen.getByRole("button", { name: "Применить выбранное (1)" })).toBeEnabled();
  });

  it("applies only the ticked rows, reports the result and refreshes the page", async () => {
    api.mockResolvedValueOnce(
      preview([row({ key: "A|B" }), row({ key: "G|H", homeName: "Минск", awayName: "Гомель" })]),
    );
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Показать, что изменится" }));
    const boxes = await screen.findAllByRole("checkbox");
    await userEvent.click(boxes[1]!);
    expect(screen.getByRole("button", { name: "Применить выбранное (1)" })).toBeVisible();

    api.mockResolvedValueOnce({ created: 1, updated: 0, skipped: [] });
    await userEvent.click(screen.getByRole("button", { name: "Применить выбранное (1)" }));

    await waitFor(() =>
      expect(api).toHaveBeenLastCalledWith("/admin/fixtures", {
        method: "POST",
        json: { tourId: TOUR, round: 3, keys: ["A|B"] },
      }),
    );
    expect(await screen.findByText("Готово: создано матчей — 1, обновлено — 0.")).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("says that the source did not answer and keeps the page as it was", async () => {
    api.mockRejectedValue(new ApiClientError({ status: 502, code: "fixtures.unavailable" }));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Показать, что изменится" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Источник не ответил");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not ask for a round that does not exist", async () => {
    setup();
    await userEvent.clear(screen.getByLabelText("Тур лиги"));
    await userEvent.type(screen.getByLabelText("Тур лиги"), "0");
    expect(screen.getByRole("button", { name: "Показать, что изменится" })).toBeDisabled();
  });
});
