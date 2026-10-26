import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PredictionCell, RatingRow, StatsRow, TourMatch } from "@/server/services/rating";

vi.mock("next/image", () => ({ default: () => null }));

const { SeasonRatingTable, TourRatingTable } = await import("./rating-table");
const { ProfileStats } = await import("./profile-stats");

const row = (over: Partial<RatingRow>): RatingRow => ({
  userId: "u1",
  nickname: "Аня",
  avatarUrl: null,
  place: 1,
  final: false,
  exactCount: 2,
  outcomeCount: 3,
  missCount: 1,
  points: 9,
  predictionsCount: 6,
  trend: null,
  ...over,
});

describe("SeasonRatingTable", () => {
  it("shows place, linked participant, counters and points", () => {
    render(<SeasonRatingTable rows={[row({})]} />);
    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(["1", "ААня", "1", "3", "2", "9"]);
    expect(screen.getByRole("link", { name: /Аня/ })).toHaveAttribute(
      "href",
      "/u/%D0%90%D0%BD%D1%8F",
    );
  });

  it("marks skipped stretches before a row and at the end", () => {
    render(
      <SeasonRatingTable
        rows={[row({ userId: "a", nickname: "Аня" }), row({ userId: "b", nickname: "Боря" })]}
        gapBefore={{ b: 29 }}
        gapAfter={1}
      />,
    );
    expect(screen.getByText("… ещё 29 участников")).toBeInTheDocument();
    expect(screen.getByText("… ещё 1 участник")).toBeInTheDocument();
    const gap = screen.getByText("… ещё 29 участников").closest("td");
    expect(gap).toHaveAttribute("colspan", "6");
  });

  it("gives equal participants the same place", () => {
    render(
      <SeasonRatingTable
        rows={[
          row({ userId: "a", nickname: "Аня", place: 2 }),
          row({ userId: "b", nickname: "Боря", place: 2 }),
        ]}
      />,
    );
    const places = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[0]!.textContent);
    expect(places).toEqual(["2", "2"]);
  });

  it("marks final places of a closed season", () => {
    render(<SeasonRatingTable rows={[row({ final: true })]} />);
    expect(screen.getByText("итог")).toBeVisible();
  });

  it("offers full column names, short ones with a legend for phones", () => {
    render(<SeasonRatingTable rows={[row({})]} />);
    expect(screen.getByText("Очков")).toBeInTheDocument();
    expect(screen.getByText("Σ")).toBeInTheDocument();
    expect(screen.getByText(/Н — неверных прогнозов/)).toBeInTheDocument();
  });

  it("does not link a participant without a nickname and handles an empty table", () => {
    render(<SeasonRatingTable rows={[row({ nickname: null })]} />);
    expect(screen.queryByRole("link")).toBeNull();
    render(<SeasonRatingTable rows={[]} />);
    expect(screen.getByText("Пока никто не сделал прогнозов в этом сезоне.")).toBeVisible();
  });
});

describe("highlighting the visitor", () => {
  const rows = [
    row({ userId: "a", nickname: "Аня" }),
    row({ userId: "b", nickname: "Боря", place: 2 }),
  ];

  it("marks only the visitor's own row in the season table", () => {
    render(<SeasonRatingTable rows={rows} currentUserId="b" />);
    const [, anya, borya] = screen.getAllByRole("row");
    expect(borya).toHaveClass("bg-accent/25!");
    expect(borya).toHaveAttribute("aria-current", "true");
    expect(anya).not.toHaveClass("bg-accent/25!");
  });

  it("marks nobody for a guest", () => {
    render(<SeasonRatingTable rows={rows} />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });
});

describe("TourRatingTable", () => {
  const matches: TourMatch[] = [
    {
      id: "m1",
      kickoffAt: "2026-10-01T15:00:00.000Z",
      status: "finished",
      homeName: "Динамо",
      awayName: "БАТЭ",
      homeScore: 2,
      awayScore: 1,
    },
    {
      id: "m2",
      kickoffAt: "2026-10-02T15:00:00.000Z",
      status: "scheduled",
      homeName: "Нафтан",
      awayName: "Гомель",
      homeScore: null,
      awayScore: null,
    },
  ];
  const cells: Record<string, Record<string, PredictionCell>> = {
    u1: {
      m1: { homeScore: 2, awayScore: 1, result: "exact", points: 3 },
      m2: { homeScore: 0, awayScore: 0, result: null, points: null },
    },
  };

  it("shows each prediction per match, the result badge and points once a match is played", () => {
    render(<TourRatingTable rows={[row({ points: 3 })]} matches={matches} cells={cells} />);
    expect(screen.getByText("Динамо — БАТЭ")).toBeVisible();
    expect(screen.getByText("итог 2:1")).toBeVisible();
    expect(screen.getByText("2 : 1")).toBeVisible();
    expect(screen.getByText("Точный счёт")).toBeVisible();
    expect(screen.getByText("+3")).toBeVisible();
    // The unplayed match shows the prediction without a badge.
    expect(screen.getByText("0 : 0")).toBeVisible();
  });

  it("shows a dash where the participant made no prediction", () => {
    render(<TourRatingTable rows={[row({})]} matches={matches} cells={{}} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("handles a tour without predictions", () => {
    render(<TourRatingTable rows={[]} matches={matches} cells={{}} />);
    expect(screen.getByText("В этом туре пока нет прогнозов.")).toBeVisible();
  });
});

describe("ProfileStats", () => {
  const stat = (over: Partial<StatsRow>): StatsRow => ({
    seasonId: "s1",
    tournamentName: "Высшая лига",
    seasonName: "2026",
    predictionsCount: 10,
    winsCount: 6,
    lossesCount: 3,
    points: 14,
    winRate: 66.7,
    place: 4,
    final: false,
    ...over,
  });

  it("shows a row per tournament and season with the win rate", () => {
    render(<ProfileStats rows={[stat({})]} />);
    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "Высшая лига",
      "2026",
      "10",
      "6",
      "3",
      "14",
      "66,7%",
      "4",
    ]);
  });

  it("marks the final place of a closed season and shows a dash without graded predictions", () => {
    render(<ProfileStats rows={[stat({ final: true, place: 1, winRate: null })]} />);
    expect(screen.getByText("итог")).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
  });

  it("has an empty state", () => {
    render(<ProfileStats rows={[]} />);
    expect(screen.getByText("Пока нет прогнозов.")).toBeVisible();
  });
});

describe("place trend", () => {
  it("shows places gained and lost with text, none when unchanged or unknown", () => {
    render(
      <SeasonRatingTable
        rows={[
          row({ userId: "a", nickname: "Аня", trend: 2 }),
          row({ userId: "b", nickname: "Боря", place: 2, trend: -1 }),
          row({ userId: "c", nickname: "Вика", place: 3, trend: 0 }),
          row({ userId: "d", nickname: "Гоша", place: 4, trend: null }),
        ]}
      />,
    );
    expect(screen.getByTitle("Поднялись на 2 за последний тур")).toHaveTextContent("▲2");
    expect(screen.getByTitle("Опустились на 1 за последний тур")).toHaveTextContent("▼1");
    expect(screen.getAllByText(/[▲▼]/)).toHaveLength(2);
  });
});
