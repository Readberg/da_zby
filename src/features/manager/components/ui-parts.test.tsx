import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ru } from "@/messages/ru";
import type { Player } from "@/server/api/v1/schemas/manager";

const api = vi.fn();
let pathname = "/manager";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));
vi.mock("@/i18n/use-app-pathname", () => ({ useAppPathname: () => pathname }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { HelpHint } = await import("./help-hint");
const { Countdown } = await import("./countdown");
const { PlayerLink } = await import("./player-link");
const { ManagerTabs } = await import("./manager-tabs");
const { FaqView } = await import("./faq-view");
const { ClubKit } = await import("./club-kit");
const t = ru.manager;

const card: Player = {
  id: "11111111-1111-4111-8111-111111111111",
  firstName: "Иван",
  lastName: "Новик",
  position: "MID",
  age: 22,
  citizenship: "BY",
  overall: 61,
  real: 55.7,
  form: 80,
  fitness: 80,
  morale: 80,
  injuredUntil: null,
  trainingFocus: "passing",
  retiring: false,
  nominal: 1120,
  academyClubName: "Динамо Тест",
  attributes: [{ key: "passing", value: 70 }],
};

beforeEach(() => {
  api.mockReset().mockImplementation(async (path: string) => {
    if (path === "/me") return { utcOffsetMinutes: 180 };
    if (path.startsWith("/manager/player/stats")) {
      return {
        playerId: card.id,
        name: "Иван Новик",
        position: "FWD",
        seasons: [],
        career: {
          matches: 0,
          goals: 0,
          assists: 0,
          shots: 0,
          shotsOnTarget: 0,
          injuries: 0,
          cleanSheets: 0,
        },
      };
    }
    if (path.startsWith("/manager/player")) return card;
    throw new Error("unexpected " + path);
  });
  pathname = "/manager";
});

afterEach(() => {
  vi.useRealTimers();
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

describe("HelpHint", () => {
  it("is a small circle with a question mark that opens the text on a click and closes on Escape", async () => {
    render(<HelpHint faq="money">Деньги клуба</HelpHint>);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: t.hints.label });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(button);
    expect(screen.getByRole("note")).toHaveTextContent("Деньги клуба");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("leads to the matching part of the FAQ", async () => {
    render(<HelpHint faq="money">Текст</HelpHint>);
    await userEvent.setup().click(screen.getByRole("button", { name: t.hints.label }));
    expect(screen.getByRole("link", { name: t.hints.more })).toHaveAttribute(
      "href",
      "/manager/faq#money",
    );
  });

  it("has no link when it belongs to no part of the FAQ", async () => {
    render(<HelpHint>Текст</HelpHint>);
    await userEvent.setup().click(screen.getByRole("button", { name: t.hints.label }));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closes on a click outside", async () => {
    render(
      <>
        <HelpHint>Текст</HelpHint>
        <p>Снаружи</p>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.hints.label }));
    expect(screen.getByRole("note")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("Снаружи"));
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("Countdown", () => {
  it("counts down every second and says so once when the time comes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T06:00:00Z"));
    const elapsed = vi.fn();
    render(<Countdown to="2026-11-20T06:00:03Z" onElapsed={elapsed} />);
    expect(screen.getByText("00:00:03")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("00:00:02")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(elapsed).toHaveBeenCalledTimes(1);
  });

  it("shows days when it is more than a day to wait", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T06:00:00Z"));
    render(<Countdown to="2026-11-22T07:00:00Z" />);
    expect(screen.getByText("2 д 25:00:00".replace("25", "01"))).toBeInTheDocument();
  });
});

describe("PlayerLink", () => {
  it("looks like a name, not like a link: no underline", () => {
    render(<PlayerLink id={card.id} name="Иван Новик" />);
    const button = screen.getByRole("button", { name: "Иван Новик" });
    expect(button.className).not.toMatch(/underline/);
    expect(button.className).toMatch(/hover:text-accent/);
  });

  it("opens the card of the player in a window, which Escape closes", async () => {
    render(<PlayerLink id={card.id} name="Иван Новик" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Иван Новик" }));
    const dialog = await screen.findByRole("dialog", { name: "Иван Новик" });
    await waitFor(() => expect(dialog).toHaveTextContent("Общий рейтинг"));
    expect(dialog).toHaveTextContent("Динамо Тест");
    expect(api).toHaveBeenCalledWith(`/manager/player?id=${card.id}`);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes with the cross and with a click on the backdrop", async () => {
    render(<PlayerLink id={card.id} name="Иван Новик" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Иван Новик" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: t.playerModal.close }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Иван Новик" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so when the card cannot be shown (a player of another club)", async () => {
    api.mockImplementation(async (path: string) => {
      if (path === "/me") return { utcOffsetMinutes: 180 };
      throw new Error("404");
    });
    render(<PlayerLink id={card.id} name="Чужой Игрок" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Чужой Игрок" }));
    expect(await screen.findByText(t.playerModal.failed)).toBeInTheDocument();
  });

  it("puts the focus back on the name when the window closes", async () => {
    render(<PlayerLink id={card.id} name="Иван Новик" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Иван Новик" });
    await user.click(button);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(button).toHaveFocus();
  });
});

describe("ManagerTabs", () => {
  const tabs = [
    { href: "/manager", label: "Клуб" },
    { href: "/manager/lineup", label: "Состав" },
    { href: "/manager/faq", label: "FAQ" },
  ];

  it("marks the current page, and the club tab only on the club page itself", () => {
    pathname = "/manager/lineup";
    render(<ManagerTabs tabs={tabs} label="Менеджер" />);
    expect(screen.getByRole("link", { name: "Состав" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Клуб" })).not.toHaveAttribute("aria-current");
  });

  it("has a tab of the FAQ of the game", () => {
    render(<ManagerTabs tabs={tabs} label="Менеджер" />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/manager/faq");
  });
});

describe("FaqView", () => {
  it("has a navigation to every section and every section has its anchor", () => {
    const { container } = render(<FaqView />);
    const nav = screen.getByRole("navigation", { name: t.faq.nav });
    for (const section of t.faq.sections) {
      expect(nav.querySelector(`a[href="#${section.id}"]`)).not.toBeNull();
      expect(container.querySelector(`section#${section.id}`)).not.toBeNull();
    }
  });

  it("explains the money and the rules of the market with the numbers of the game", () => {
    render(<FaqView />);
    expect(screen.getByText(/\+120 \$ билеты/)).toBeInTheDocument();
    expect(screen.getByText(/не меньше 10 матчей/)).toBeInTheDocument();
  });

  it("has the sections the hints lead to", () => {
    const ids = t.faq.sections.map((s) => s.id);
    for (const id of ["start", "matches", "training", "money", "market", "season"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("ClubKit", () => {
  it("draws a shirt and shorts in the two colours and is described for screen readers", () => {
    const { container } = render(
      <ClubKit primary="#d32f2f" secondary="#f5f5f5" label={t.kitLabel} />,
    );
    expect(screen.getByRole("img", { name: t.kitLabel })).toBeInTheDocument();
    const fills = [...container.querySelectorAll("path")].map((p) => (p as SVGElement).style.fill);
    expect(fills).toContain("rgb(211, 47, 47)");
    expect(fills).toContain("rgb(245, 245, 245)");
  });

  it("is decorative without a label", () => {
    const { container } = render(<ClubKit primary="#d32f2f" secondary="#f5f5f5" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
