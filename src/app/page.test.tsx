import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/videos.server", () => ({
  videosService: { getLatestVideos: vi.fn(() => new Promise(() => {})) },
}));
vi.mock("@/server/services/home.cached", () => ({ getHomeCached: () => new Promise(() => {}) }));
vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: () => new Promise(() => {}),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { default: Home } = await import("./page");

describe("Home page (landing)", () => {
  it("states what the site is and offers one main action while data is loading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Футбол интереснее, когда ты в игре",
    );
    // Until the session is known the guest label is shown (most visitors are guests).
    expect(screen.getByText("Войти и сделать прогноз")).toBeVisible();
    expect(screen.getByRole("link", { name: "Как это работает" })).toHaveAttribute("href", "#how");
  });

  it("explains how it works in three steps with the default points", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Как это работает" })).toBeVisible();
    const steps = screen.getAllByRole("listitem").filter((li) => li.closest("ol"));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Точный счёт — 3 очка, верный исход — 1 очко/)).toBeVisible();
  });

  it("keeps the channel's videos below, under their own heading, with a loading state", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
    expect(screen.getAllByRole("status", { name: "Загрузка…" }).length).toBeGreaterThan(0);
  });
});
