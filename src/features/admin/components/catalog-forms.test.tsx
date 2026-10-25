import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, api, upload } = vi.hoisted(() => ({
  refresh: vi.fn(),
  api: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload }) } }),
}));

const { TournamentForm } = await import("./tournament-form");
const { ClubForm } = await import("./club-form");
const { ApiClientError } = await import("@/lib/api-client");

const ID = "11111111-1111-4111-8111-111111111111";
const tournament = {
  id: ID,
  name: "Высшая лига",
  slug: "vysshaya-liga",
  kind: "score_prediction",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
};

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue({ error: null });
});

describe("TournamentForm", () => {
  it("starts a new tournament with the default points 3 and 1", () => {
    render(<TournamentForm />);
    expect(screen.getByLabelText("Очки за точный счёт")).toHaveValue(3);
    expect(screen.getByLabelText("Очки за верный исход")).toHaveValue(1);
  });

  it("shows field errors and sends nothing for invalid input", async () => {
    render(<TournamentForm />);
    await userEvent.type(screen.getByLabelText("Название"), "Кубок");
    await userEvent.type(screen.getByLabelText(/Slug/), "Bad Slug");
    await userEvent.click(screen.getByRole("button", { name: "Создать турнир" }));

    expect(screen.getByText(/латиница в нижнем регистре/)).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it("creates a tournament and refreshes the list", async () => {
    render(<TournamentForm />);
    await userEvent.type(screen.getByLabelText("Название"), "Кубок Беларуси");
    await userEvent.type(screen.getByLabelText(/Slug/), "kubok");
    await userEvent.click(screen.getByRole("button", { name: "Создать турнир" }));

    expect(api).toHaveBeenCalledWith("/admin/tournaments", {
      method: "POST",
      json: {
        name: "Кубок Беларуси",
        slug: "kubok",
        pointsExact: 3,
        pointsOutcome: 1,
        isActive: true,
      },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("puts the server's duplicate-slug message next to the slug field", async () => {
    api.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "admin.duplicate",
        errors: [{ field: "slug", message: "Такой slug уже занят" }],
      }),
    );
    render(<TournamentForm tournament={tournament} />);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Такой slug уже занят")).toBeVisible();
  });

  it("re-grades the seasons of an existing tournament and reports how many", async () => {
    api.mockResolvedValue({ seasons: 2 });
    render(<TournamentForm tournament={tournament} />);
    await userEvent.click(screen.getByRole("button", { name: "Пересчитать сезоны" }));

    expect(api).toHaveBeenCalledWith("/admin/tournaments/recalculate", {
      method: "POST",
      json: { tournamentId: ID },
    });
    expect(await screen.findByText("Пересчитано сезонов: 2")).toBeVisible();
  });
});

const club = { id: ID, name: "Динамо Минск", shortName: null, logoPath: null, logoUrl: null };
const file = (type: string, size = 1000) => new File([new Uint8Array(size)], "logo", { type });

describe("ClubForm", () => {
  it("creates a club", async () => {
    render(<ClubForm />);
    await userEvent.type(screen.getByLabelText("Название"), "Нафтан");
    await userEvent.click(screen.getByRole("button", { name: "Добавить клуб" }));
    expect(api).toHaveBeenCalledWith("/admin/clubs", {
      method: "POST",
      json: { name: "Нафтан", shortName: null, logoPath: null },
    });
  });

  it("rejects a wrong or a big logo before uploading", async () => {
    render(<ClubForm />);
    const input = screen.getByLabelText("Выбрать логотип", { selector: "input" });
    await userEvent.upload(input, file("image/gif"), { applyAccept: false });
    expect(await screen.findByText("Подходят только JPEG, PNG и WebP.")).toBeVisible();
    await userEvent.upload(input, file("image/png", 1024 * 1024 + 1), { applyAccept: false });
    expect(await screen.findByText("Файл больше 1 МБ.")).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads a valid logo to the bucket and attaches the path when saving", async () => {
    render(<ClubForm />);
    URL.createObjectURL = vi.fn(() => "blob:logo");
    await userEvent.type(screen.getByLabelText("Название"), "Нафтан");
    await userEvent.upload(
      screen.getByLabelText("Выбрать логотип", { selector: "input" }),
      file("image/png"),
      { applyAccept: false },
    );
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    const path = upload.mock.calls[0]![0] as string;
    expect(path).toMatch(/^[\w-]+\.png$/);

    await userEvent.click(screen.getByRole("button", { name: "Добавить клуб" }));
    expect(api).toHaveBeenCalledWith("/admin/clubs", {
      method: "POST",
      json: { name: "Нафтан", shortName: null, logoPath: path },
    });
  });

  it("explains that a club with matches cannot be deleted", async () => {
    api.mockRejectedValue(new ApiClientError({ status: 409, code: "admin.in_use" }));
    render(<ClubForm club={club} />);
    await userEvent.click(screen.getByRole("button", { name: "Удалить клуб" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("у него есть матчи");
  });
});
