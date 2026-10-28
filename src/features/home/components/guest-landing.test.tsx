import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PredictionsPublic } from "@/server/services/predictions";

const { home } = vi.hoisted(() => ({ home: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/server/services/home.cached", () => ({ getHomeCached: () => home() }));

const { AdSpace, UpcomingMatches } = await import("./guest-landing");

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
  it("lists at most four match cards of the next tour with time, day and tour", async () => {
    home.mockResolvedValue({ pub: pub(6), leaders: [] });
    render(await UpcomingMatches());
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Дом0")).toBeVisible();
    expect(within(rows[0]).getByText(/Высшая лига · Ближайший тур · 7/)).toBeVisible();
    // The kickoff time stands where a score would, the day below it.
    expect(within(rows[0]).getByText(/^\d{2}:\d{2}$/)).toBeVisible();
    expect(within(rows[0]).getByText(/^\d{1,2} [а-я]+$/)).toBeVisible();
  });

  it("has one button for every match, not one per row", async () => {
    home.mockResolvedValue({ pub: pub(6), leaders: [] });
    render(await UpcomingMatches());
    const links = screen.getAllByRole("link", { name: "Сделать прогноз" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/login?next=%2Fpredictions");
    for (const row of screen.getAllByRole("listitem")) {
      expect(within(row).queryByRole("link")).toBeNull();
    }
  });

  it("says the tour is coming soon when there are no matches", async () => {
    home.mockResolvedValue({ pub: pub(0), leaders: [] });
    render(await UpcomingMatches());
    expect(screen.getByText("Скоро начнём")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Сделать прогноз" })).toBeNull();
  });
});

describe("AdSpace", () => {
  it("says an ad could be here and leads to the contacts in the footer", () => {
    render(<AdSpace />);
    expect(screen.getByRole("heading", { name: "Здесь могла быть ваша реклама" })).toBeVisible();
    expect(screen.getByText("Партнёры")).toBeVisible();
    expect(screen.getByRole("link", { name: "Связаться" })).toHaveAttribute("href", "#contacts");
  });
});
