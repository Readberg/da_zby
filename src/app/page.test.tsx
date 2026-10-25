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
    // Until the session is known the guest landing is shown (most visitors are guests).
    expect(screen.getByRole("link", { name: "Войти через Telegram" })).toHaveAttribute(
      "href",
      "/login?next=%2Fpredictions",
    );
  });

  it("explains how it works in three steps with the default points", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Как это работает" })).toBeVisible();
    const steps = screen.getAllByRole("listitem").filter((li) => li.closest("ol"));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Точный счёт — 3 очка, верный исход — 1 очко/)).toBeVisible();
  });

  it("answers the common questions, the first one open", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Вопросы? Ответы." })).toBeVisible();
    const questions = screen
      .getAllByRole("button", { expanded: false })
      .concat(screen.getAllByRole("button", { expanded: true }));
    expect(questions.filter((q) => q.hasAttribute("aria-controls"))).toHaveLength(8);
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(screen.getByText("Это бесплатно?")).toBeVisible();
  });

  it("links the community, labels the rating example as an example", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@da_zby",
    );
    expect(screen.getByText("Пример рейтинга")).toBeVisible();
  });

  it("keeps the channel's videos below, under their own heading, with a loading state", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
    expect(screen.getAllByRole("status", { name: "Загрузка…" }).length).toBeGreaterThan(0);
  });
});
