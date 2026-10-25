import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, push, api } = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  api: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { MatchForm } = await import("./match-form");
const { TourForm } = await import("./tour-forms");
const { RosterForm, SeasonActions } = await import("./season-forms");
const { ApiClientError } = await import("@/lib/api-client");

const S = "11111111-1111-4111-8111-111111111111";
const T = "44444444-4444-4444-8444-444444444444";
const M = "55555555-5555-4555-8555-555555555555";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";
const clubs = [
  { id: A, name: "Динамо" },
  { id: B, name: "БАТЭ" },
];
const match = {
  id: M,
  tourId: T,
  homeClubId: A,
  awayClubId: B,
  homeName: "Динамо",
  awayName: "БАТЭ",
  kickoffAt: "2026-10-30T15:00:00.000Z",
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  api.mockReset().mockResolvedValue({});
});

describe("MatchForm", () => {
  it("creates a match, converting the entered time from the admin's zone to UTC", async () => {
    render(<MatchForm tourId={T} clubs={clubs} offsetMinutes={180} />);
    await userEvent.selectOptions(screen.getByLabelText("Хозяева"), A);
    await userEvent.selectOptions(screen.getByLabelText("Гости"), B);
    await userEvent.type(screen.getByLabelText(/Начало/), "2026-10-30T18:00");
    await userEvent.click(screen.getByRole("button", { name: "Добавить матч" }));

    expect(api).toHaveBeenCalledWith("/admin/matches", {
      method: "POST",
      json: {
        tourId: T,
        homeClubId: A,
        awayClubId: B,
        kickoffAt: "2026-10-30T15:00:00.000Z",
      },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("refuses the same club on both sides without calling the server", async () => {
    render(<MatchForm tourId={T} clubs={clubs} offsetMinutes={180} />);
    await userEvent.selectOptions(screen.getByLabelText("Хозяева"), A);
    await userEvent.selectOptions(screen.getByLabelText("Гости"), A);
    await userEvent.type(screen.getByLabelText(/Начало/), "2026-10-30T18:00");
    await userEvent.click(screen.getByRole("button", { name: "Добавить матч" }));
    expect(screen.getByText("Хозяева и гости должны быть разными клубами")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it("shows score fields only for a finished match and requires both", async () => {
    render(<MatchForm tourId={T} clubs={clubs} offsetMinutes={180} match={match} />);
    expect(screen.queryByLabelText("Голы хозяев")).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Статус"), "finished");
    await userEvent.type(screen.getByLabelText("Голы хозяев"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByText("Укажите счёт")).toBeVisible();
    expect(api).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Голы гостей"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(api).toHaveBeenCalledWith("/admin/matches", {
      method: "PATCH",
      json: expect.objectContaining({
        id: M,
        status: "finished",
        homeScore: 2,
        awayScore: 1,
        kickoffAt: "2026-10-30T15:00:00.000Z",
      }),
    });
  });

  it("explains that a match with predictions cannot be deleted", async () => {
    api.mockRejectedValue(new ApiClientError({ status: 409, code: "admin.in_use" }));
    render(<MatchForm tourId={T} clubs={clubs} offsetMinutes={180} match={match} />);
    await userEvent.click(screen.getByRole("button", { name: "Удалить матч" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("поставьте статус «отменён»");
  });

  it("disables everything for a closed season", () => {
    render(<MatchForm tourId={T} clubs={clubs} offsetMinutes={180} match={match} disabled />);
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(screen.getByLabelText("Хозяева")).toBeDisabled();
  });
});

describe("TourForm", () => {
  it("creates a tour with the next number by default and no pinned deadline", async () => {
    render(<TourForm seasonId={S} offsetMinutes={180} />);
    await userEvent.click(screen.getByRole("button", { name: "Создать тур" }));
    expect(api).toHaveBeenCalledWith("/admin/tours", {
      method: "POST",
      json: { seasonId: S, title: null, deadlineOverride: null },
    });
  });

  it("pins a deadline entered in the admin's zone", async () => {
    render(<TourForm seasonId={S} offsetMinutes={180} />);
    await userEvent.type(screen.getByLabelText("Дедлайн вручную"), "2026-10-30T12:00");
    await userEvent.click(screen.getByRole("button", { name: "Создать тур" }));
    expect(api).toHaveBeenCalledWith("/admin/tours", {
      method: "POST",
      json: { seasonId: S, title: null, deadlineOverride: "2026-10-30T09:00:00.000Z" },
    });
  });

  it("shows the server's duplicate-number message at the field", async () => {
    api.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "admin.duplicate",
        errors: [{ field: "number", message: "Тур с таким номером уже есть в сезоне" }],
      }),
    );
    render(<TourForm seasonId={S} offsetMinutes={180} />);
    await userEvent.type(screen.getByLabelText(/Номер тура/), "1");
    await userEvent.click(screen.getByRole("button", { name: "Создать тур" }));
    expect(await screen.findByText("Тур с таким номером уже есть в сезоне")).toBeVisible();
  });
});

describe("SeasonActions", () => {
  it("asks twice before closing a season", async () => {
    render(<SeasonActions seasonId={S} status="active" />);
    await userEvent.click(screen.getByRole("button", { name: "Закрыть сезон" }));
    expect(api).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Да, закрыть" }));
    expect(api).toHaveBeenCalledWith("/admin/seasons/close", {
      method: "POST",
      json: { seasonId: S },
    });
    expect(await screen.findByText("Сезон закрыт")).toBeVisible();
  });

  it("offers only the rollback for a closed season", async () => {
    render(<SeasonActions seasonId={S} status="closed" />);
    expect(screen.queryByRole("button", { name: "Закрыть сезон" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Откатить закрытие" }));
    await userEvent.click(screen.getByRole("button", { name: "Да, откатить" }));
    expect(api).toHaveBeenCalledWith("/admin/seasons/reopen", {
      method: "POST",
      json: { seasonId: S },
    });
  });
});

describe("RosterForm", () => {
  it("saves the chosen clubs", async () => {
    render(<RosterForm seasonId={S} clubs={clubs} selected={[A]} disabled={false} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "БАТЭ" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(api).toHaveBeenCalledWith("/admin/seasons/clubs", {
      method: "PUT",
      json: { seasonId: S, clubIds: [A, B] },
    });
  });

  it("shows why a club cannot be removed", async () => {
    api.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "admin.in_use",
        errors: [
          { field: "clubIds", message: "Нельзя убрать клуб, у которого уже есть матчи сезона" },
        ],
      }),
    );
    render(<RosterForm seasonId={S} clubs={clubs} selected={[A, B]} disabled={false} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "БАТЭ" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("уже есть матчи сезона");
  });
});
