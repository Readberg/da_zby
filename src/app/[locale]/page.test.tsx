import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// The page reads its language from the `[locale]` segment before it renders.
const props = {
  params: Promise.resolve({ locale: "ru" }),
  searchParams: Promise.resolve({}),
} as Parameters<typeof Home>[0];

describe("Home page (landing)", () => {
  it("states what the site is and offers one main action while data is loading", async () => {
    render(await Home(props));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Футбол интереснее, когда ты в игре",
    );
    // Until the session is known the guest landing is shown (most visitors are guests).
    expect(screen.getByRole("link", { name: "Войти через Telegram" })).toHaveAttribute(
      "href",
      "/login?next=%2Fpredictions",
    );
  });

  it("explains how it works in three steps with the default points", async () => {
    render(await Home(props));
    expect(screen.getByRole("heading", { level: 2, name: "Как это работает" })).toBeVisible();
    const steps = screen.getAllByRole("listitem").filter((li) => li.closest("ol"));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Точный счёт — 3 очка, верный исход — 1 очко/)).toBeVisible();
  });

  it("answers the common questions, the first one open", async () => {
    render(await Home(props));
    expect(screen.getByRole("heading", { level: 2, name: "Вопросы? Ответы." })).toBeVisible();
    const questions = screen
      .getAllByRole("button", { expanded: false })
      .concat(screen.getAllByRole("button", { expanded: true }));
    expect(questions.filter((q) => q.hasAttribute("aria-controls"))).toHaveLength(8);
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(screen.getByText("Это бесплатно?")).toBeVisible();
  });

  it("tells Umami which question was opened", async () => {
    const umami = { track: vi.fn() };
    (window as unknown as { umami: typeof umami }).umami = umami;
    render(await Home(props));
    await userEvent.click(screen.getByRole("button", { name: "Это бесплатно?" }));
    expect(umami.track).toHaveBeenCalledWith("faq-open", { question: 6 });
    delete (window as unknown as { umami?: unknown }).umami;
  });

  it("marks the calls to action so Umami counts their clicks by place", async () => {
    render(await Home(props));
    const hero = screen.getByRole("link", { name: "Войти через Telegram" });
    expect(hero).toHaveAttribute("data-umami-event", "cta-click");
    expect(hero).toHaveAttribute("data-umami-event-where", "hero");
  });

  it("links the community, labels the rating example as an example", async () => {
    render(await Home(props));
    expect(screen.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@da_zby",
    );
    expect(screen.getByText("Пример рейтинга")).toBeVisible();
  });

  it("keeps the channel's videos below, under their own heading, with a loading state", async () => {
    render(await Home(props));
    expect(screen.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
    expect(screen.getAllByRole("status", { name: "Загрузка…" }).length).toBeGreaterThan(0);
  });
});
