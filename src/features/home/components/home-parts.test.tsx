import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PredictionsPublic } from "@/server/services/predictions";

const { home } = vi.hoisted(() => ({ home: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/server/services/home.cached", () => ({ getHomeCached: () => home() }));

const { MemberAction, NextTour } = await import("./next-tour");
const { StepsWithPoints } = await import("./guest-landing");
const { LeadersList } = await import("./leaders");

const club = (name: string) => ({ id: name, name, logoUrl: null });
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function pub(over: Partial<PredictionsPublic> = {}): PredictionsPublic {
  return {
    tournaments: [],
    tournament: { id: "t", slug: "liga", name: "Высшая лига", pointsExact: 5, pointsOutcome: 2 },
    seasons: [],
    season: { id: "s", name: "2026", status: "active" },
    tours: [{ id: "tour1", number: 7, title: null, deadlineOverride: null }],
    matches: Array.from({ length: 4 }, (_, i) => ({
      id: `m${i}`,
      tourId: "tour1",
      kickoffAt: future(2 + i),
      status: "scheduled" as const,
      home: club(`Дом${i}`),
      away: club(`Гость${i}`),
      homeScore: null,
      awayScore: null,
    })),
    ...over,
  };
}

beforeEach(() => {
  home.mockReset().mockResolvedValue({ pub: pub(), leaders: [] });
});

describe("MemberAction", () => {
  it("sends a signed-in visitor straight to the predictions", () => {
    render(<MemberAction />);
    const link = screen.getByRole("link", { name: "Сделать прогноз" });
    expect(link).toHaveAttribute("href", "/predictions");
  });
});

describe("NextTour", () => {
  it("shows the next tour with its deadline and the first three matches", async () => {
    render(await NextTour());
    expect(screen.getByRole("heading", { name: /Ближайший тур · 7/ })).toBeVisible();
    expect(screen.getByText("Высшая лига")).toBeVisible();
    expect(screen.getByText(/Приём прогнозов до/)).toBeVisible();
    expect(screen.getByText("Дом0")).toBeVisible();
    expect(screen.getByText("Гость2")).toBeVisible();
    expect(screen.queryByText("Дом3")).toBeNull();
    expect(screen.getByText("И ещё матчей в туре: 1")).toBeVisible();
  });

  it("says that the tournament starts soon when there is no tour yet", async () => {
    home.mockResolvedValue({ pub: pub({ tours: [], matches: [] }), leaders: [] });
    render(await NextTour());
    expect(screen.getByText("Скоро начнём")).toBeVisible();
  });

  it("says the same without any tournament", async () => {
    home.mockResolvedValue({
      pub: pub({ tournament: null, season: null, tours: [], matches: [] }),
      leaders: [],
    });
    render(await NextTour());
    expect(screen.getByText("Скоро начнём")).toBeVisible();
  });
});

describe("StepsWithPoints", () => {
  it("takes the points from the tournament settings", async () => {
    render(await StepsWithPoints());
    expect(screen.getByText(/Точный счёт — 5 очков, верный исход — 2 очка/)).toBeVisible();
  });

  it("falls back to the product defaults without a tournament", async () => {
    home.mockResolvedValue({ pub: pub({ tournament: null }), leaders: [] });
    render(await StepsWithPoints());
    expect(screen.getByText(/Точный счёт — 3 очка, верный исход — 1 очко/)).toBeVisible();
  });
});

describe("LeadersList", () => {
  const leader = (place: number, nickname: string, points: number) => ({
    userId: nickname,
    nickname,
    avatarUrl: null,
    place,
    final: false,
    exactCount: 0,
    outcomeCount: 0,
    missCount: 0,
    points,
    predictionsCount: 0,
    trend: null,
  });

  it("lists the leaders with places, links and a link to the full rating", async () => {
    home.mockResolvedValue({ pub: pub(), leaders: [leader(1, "Аня", 12), leader(2, "Боря", 9)] });
    render(await LeadersList());
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("1")).toBeVisible();
    expect(within(items[0]!).getByRole("link", { name: "Аня" })).toHaveAttribute(
      "href",
      "/u/%D0%90%D0%BD%D1%8F",
    );
    expect(screen.getByRole("link", { name: "Весь рейтинг" })).toHaveAttribute(
      "href",
      expect.stringContaining("/rating?tournament=liga&season=s"),
    );
  });

  it("renders nothing while nobody has predictions", async () => {
    const result = await LeadersList();
    expect(result).toBeNull();
  });
});
