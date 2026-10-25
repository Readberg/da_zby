import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PredictionsPublic } from "@/server/services/predictions";

const { home } = vi.hoisted(() => ({ home: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/server/services/home.cached", () => ({ getHomeCached: () => home() }));

const { UpcomingMatches } = await import("./guest-landing");

const club = (name: string) => ({ id: name, name, logoUrl: null });
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function pub(matchCount: number): PredictionsPublic {
  return {
    tournaments: [],
    tournament: { id: "t", slug: "liga", name: "Высшая лига", pointsExact: 3, pointsOutcome: 1 },
    seasons: [],
    season: { id: "s", name: "2026", status: "active" },
    tours: [{ id: "tour1", number: 7, title: null, deadlineOverride: null }],
    matches: Array.from({ length: matchCount }, (_, i) => ({
      id: `m${i}`,
      tourId: "tour1",
      kickoffAt: future(2 + i),
      status: "scheduled" as const,
      home: club(`Дом${i}`),
      away: club(`Гость${i}`),
      homeScore: null,
      awayScore: null,
    })),
  };
}

beforeEach(() => home.mockReset());

describe("UpcomingMatches", () => {
  it("lists at most four matches of the next tour, each leading to sign-in", async () => {
    home.mockResolvedValue({ pub: pub(6), leaders: [] });
    render(await UpcomingMatches());
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Дом0")).toBeVisible();
    expect(within(rows[0]).getByText(/Высшая лига · Ближайший тур · 7/)).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: "Сделать прогноз" })) {
      expect(link).toHaveAttribute("href", "/login?next=%2Fpredictions");
    }
  });

  it("says the tour is coming soon when there are no matches", async () => {
    home.mockResolvedValue({ pub: pub(0), leaders: [] });
    render(await UpcomingMatches());
    expect(screen.getByText("Скоро начнём")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Сделать прогноз" })).toBeNull();
  });
});
