import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const { TournamentsManager } = await import("./tournaments-manager");
const { ClubsManager } = await import("./clubs-manager");
const { SeasonsManager } = await import("./seasons-manager");

const T = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  kind: "score_prediction",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
});

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

describe("TournamentsManager", () => {
  it("shows a created tournament at once, before the page data is refreshed", async () => {
    api.mockResolvedValue(T("kubok", "Кубок Беларуси"));
    render(<TournamentsManager initial={[T("liga", "Высшая лига")]} />);
    expect(screen.queryByRole("heading", { name: "Кубок Беларуси" })).toBeNull();

    await userEvent.type(
      screen.getByLabelText("Название", { selector: "#t-new-name" }),
      "Кубок Беларуси",
    );
    await userEvent.type(screen.getByLabelText(/Slug/, { selector: "#t-new-slug" }), "kubok");
    await userEvent.click(screen.getByRole("button", { name: "Создать турнир" }));

    expect(await screen.findByRole("heading", { name: "Кубок Беларуси" })).toBeVisible();
    // The server refresh is only a background confirmation.
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("does not show a tournament the server refused", async () => {
    api.mockRejectedValue(new Error("boom"));
    render(<TournamentsManager initial={[]} />);
    await userEvent.type(screen.getByLabelText("Название", { selector: "#t-new-name" }), "Кубок");
    await userEvent.type(screen.getByLabelText(/Slug/, { selector: "#t-new-slug" }), "kubok");
    await userEvent.click(screen.getByRole("button", { name: "Создать турнир" }));
    expect(await screen.findByText("Проверьте поля")).toBeVisible();
    expect(screen.getByText("Турниров пока нет.")).toBeVisible();
  });
});

const club = (id: string, name: string) => ({
  id,
  name,
  shortName: null,
  logoPath: null,
  logoUrl: null,
});

describe("ClubsManager", () => {
  it("puts a new club into the alphabetical list at once", async () => {
    api.mockResolvedValue(club("2", "Балтика"));
    render(<ClubsManager initial={[club("1", "Динамо"), club("3", "Нафтан")]} />);
    await userEvent.type(
      screen.getByLabelText("Название", { selector: "#club-new-name" }),
      "Балтика",
    );
    await userEvent.click(screen.getByRole("button", { name: "Добавить клуб" }));

    await waitFor(() => expect(screen.getAllByLabelText("Название")).toHaveLength(4));
    const names = screen
      .getAllByLabelText("Название")
      .map((input) => (input as HTMLInputElement).value)
      .filter(Boolean);
    expect(names).toEqual(["Балтика", "Динамо", "Нафтан"]);
  });

  it("removes a deleted club at once", async () => {
    api.mockResolvedValue({ id: "1" });
    render(<ClubsManager initial={[club("1", "Динамо"), club("3", "Нафтан")]} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Удалить клуб" })[0]!);
    await waitFor(() => expect(screen.queryByDisplayValue("Динамо")).toBeNull());
    expect(screen.getByDisplayValue("Нафтан")).toBeVisible();
  });
});

describe("SeasonsManager", () => {
  it("shows a new season first, at once", async () => {
    const created = {
      id: "s2",
      tournamentId: "11111111-1111-4111-8111-111111111111",
      tournamentName: "Высшая лига",
      name: "2027",
      status: "active" as const,
      closedAt: null,
      clubsCount: 0,
      toursCount: 0,
    };
    api.mockResolvedValue(created);
    render(
      <SeasonsManager
        initial={[{ ...created, id: "s1", name: "2026" }]}
        tournaments={[{ id: "11111111-1111-4111-8111-111111111111", name: "Высшая лига" }]}
      />,
    );
    await userEvent.type(screen.getByLabelText("Название сезона"), "2027");
    await userEvent.click(screen.getByRole("button", { name: "Создать сезон" }));

    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "2027",
        "2026",
      ]),
    );
  });
});
