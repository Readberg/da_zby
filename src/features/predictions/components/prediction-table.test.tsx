import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchView } from "@/server/services/predictions";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { PredictionTable } = await import("./prediction-table");
const { ApiClientError } = await import("@/lib/api-client");

const TOUR = "44444444-4444-4444-8444-444444444444";
const club = (name: string) => ({ id: name, name, logoUrl: null });

function match(id: string, over: Partial<MatchView> = {}): MatchView {
  return {
    id,
    kickoffAt: "2026-10-30T15:00:00.000Z",
    status: "scheduled",
    home: club("Динамо"),
    away: club("БАТЭ"),
    homeScore: null,
    awayScore: null,
    prediction: null,
    editable: true,
    ...over,
  };
}

const m1 = "55555555-5555-4555-8555-555555555551";
const m2 = "55555555-5555-4555-8555-555555555552";

function table(matches: MatchView[], over: Record<string, unknown> = {}) {
  return render(
    <PredictionTable
      tourId={TOUR}
      matches={matches}
      signedIn
      offsetMinutes={180}
      open
      loginHref="/login?next=%2Fpredictions"
      {...over}
    />,
  );
}

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ saved: 1 });
});

describe("PredictionTable", () => {
  it("shows the kickoff in the visitor's time zone", () => {
    table([match(m1)]);
    expect(screen.getByText("30 октября в 18:00")).toBeVisible();
  });

  it("sends only filled matches and keeps empty ones out of the request", async () => {
    table([match(m1), match(m2, { home: club("Нафтан"), away: club("Гомель") })]);
    await userEvent.type(screen.getByLabelText("Голы Динамо"), "2");
    await userEvent.type(screen.getByLabelText("Голы БАТЭ"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить прогнозы" }));

    expect(api).toHaveBeenCalledWith("/predictions", {
      method: "PUT",
      json: { tourId: TOUR, items: [{ matchId: m1, homeScore: 2, awayScore: 1 }] },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText("Сохранено")).toBeVisible();
  });

  it("does not offer saving while nothing changed", () => {
    table([match(m1, { prediction: { homeScore: 1, awayScore: 0, result: null, points: null } })]);
    expect(screen.getByRole("button", { name: "Сохранить прогнозы" })).toBeDisabled();
    expect(screen.getByLabelText("Голы Динамо")).toHaveValue(1);
  });

  it("sends only the changed prediction", async () => {
    table([match(m1, { prediction: { homeScore: 1, awayScore: 0, result: null, points: null } })]);
    await userEvent.clear(screen.getByLabelText("Голы Динамо"));
    await userEvent.type(screen.getByLabelText("Голы Динамо"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить прогнозы" }));
    expect(api).toHaveBeenCalledWith("/predictions", {
      method: "PUT",
      json: { tourId: TOUR, items: [{ matchId: m1, homeScore: 3, awayScore: 0 }] },
    });
  });

  it("asks for both numbers and rejects out-of-range scores without calling the server", async () => {
    table([match(m1)]);
    await userEvent.type(screen.getByLabelText("Голы Динамо"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить прогнозы" }));
    expect(screen.getByText("Укажите оба числа")).toBeVisible();

    await userEvent.type(screen.getByLabelText("Голы БАТЭ"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить прогнозы" }));
    expect(screen.getByText("Число от 0 до 99")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it("tells the visitor when the tour closed while the page was open", async () => {
    api.mockRejectedValue(new ApiClientError({ status: 409, code: "predictions.closed" }));
    table([match(m1)]);
    await userEvent.type(screen.getByLabelText("Голы Динамо"), "1");
    await userEvent.type(screen.getByLabelText("Голы БАТЭ"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить прогнозы" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Приём прогнозов уже закрыт");
    expect(refresh).toHaveBeenCalled();
  });

  it("locks fields after the deadline and shows the saved prediction, final score and points", () => {
    table(
      [
        match(m1, {
          status: "finished",
          homeScore: 2,
          awayScore: 1,
          editable: false,
          prediction: { homeScore: 2, awayScore: 1, result: "exact", points: 3 },
        }),
      ],
      { open: false },
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: "Сохранить прогнозы" })).toBeNull();
    expect(screen.getByLabelText("Ваш прогноз")).toHaveTextContent("2 : 1");
    expect(screen.getByText(/^Итог:/)).toHaveTextContent("2 : 1");
    expect(screen.getByText(/Очки/)).toHaveTextContent("3");
  });

  it("says when no prediction was made for a played match", () => {
    table([match(m1, { status: "finished", homeScore: 0, awayScore: 0, editable: false })], {
      open: false,
    });
    expect(screen.getByText("прогноза не было")).toBeVisible();
  });

  it("invites guests to sign in and gives them no inputs", () => {
    table([match(m1)], { signedIn: false });
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute(
      "href",
      "/login?next=%2Fpredictions",
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("shows an empty state for a tour without matches", () => {
    table([]);
    expect(screen.getByText("В этом туре пока нет матчей.")).toBeVisible();
  });

  it("shows what the visitor earned in the tour with a link to the tour table", () => {
    table(
      [
        match(m1, {
          status: "finished",
          homeScore: 2,
          awayScore: 1,
          editable: false,
          prediction: { homeScore: 2, awayScore: 1, result: "exact", points: 3 },
        }),
        match(m2, {
          status: "finished",
          homeScore: 0,
          awayScore: 0,
          editable: false,
          prediction: { homeScore: 1, awayScore: 1, result: "outcome", points: 1 },
        }),
      ],
      { open: false, ratingHref: "/rating?tour=3" },
    );
    expect(screen.getByText("Итог тура")).toBeVisible();
    expect(screen.getByText("4 очка · точных счетов: 1 · угаданных исходов: 1")).toBeVisible();
    expect(screen.getByRole("link", { name: "Таблица тура" })).toHaveAttribute(
      "href",
      "/rating?tour=3",
    );
  });

  it("has no tour result before any match is graded", () => {
    table([match(m1)]);
    expect(screen.queryByText("Итог тура")).toBeNull();
  });

  it("tells whether each prediction is saved or not", async () => {
    table([
      match(m1, { prediction: { homeScore: 1, awayScore: 0, result: null, points: null } }),
      match(m2, { home: club("Нафтан"), away: club("Гомель") }),
    ]);
    expect(screen.getByText("Сохранено")).toBeVisible();
    expect(screen.queryByText("Не сохранено")).toBeNull();

    await userEvent.type(screen.getByLabelText("Голы Нафтан"), "2");
    await userEvent.type(screen.getByLabelText("Голы Гомель"), "2");
    expect(screen.getByText("Не сохранено")).toBeVisible();

    await userEvent.clear(screen.getByLabelText("Голы Динамо"));
    await userEvent.type(screen.getByLabelText("Голы Динамо"), "5");
    expect(screen.getAllByText("Не сохранено")).toHaveLength(2);
    expect(screen.queryByText("Сохранено")).toBeNull();
  });
});
