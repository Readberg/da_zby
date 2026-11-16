import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { ru } from "@/messages/ru";
import type { LineupView, PlayerSummary } from "@/server/api/v1/schemas/manager";

const refresh = vi.fn();
const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { LineupForm } = await import("./lineup-form");
const t = ru.manager;

const counts = { GK: 2, DEF: 7, MID: 7, FWD: 4 } as const;
const players: PlayerSummary[] = (["GK", "DEF", "MID", "FWD"] as const).flatMap((position) =>
  Array.from({ length: counts[position] }, (_, i) => ({
    id: `${position}-${i}`,
    firstName: position,
    lastName: `Игрок${i}`,
    position,
    age: 22,
    citizenship: "BY",
    overall: 60 - i,
    real: 54.8 - i,
    form: 80,
    fitness: 80,
    morale: 80,
  })),
);

const ids = (position: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${position}-${i}`);

const base: LineupView = {
  formation: "4-4-2",
  mentality: "balanced",
  playerIds: [...ids("GK", 1), ...ids("DEF", 4), ...ids("MID", 4), ...ids("FWD", 2)],
  saved: false,
  locked: false,
  nextKickoffAt: "2026-11-18T07:00:00.000Z",
};

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ saved: true });
});

const form = (lineup: LineupView = base) =>
  render(<LineupForm t={t} players={players} lineup={lineup} until="18.11, 10:00" />);

describe("LineupForm", () => {
  it("shows the chosen eleven and says when the best lineup plays instead", () => {
    form();
    expect(screen.getByText(/Выбрано 11 из 11/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.lineupPage.auto))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.lineupPage.save })).toBeEnabled();
  });

  it("does not let a full line take another player", async () => {
    form();
    const user = userEvent.setup();
    const defenders = screen.getByRole("group", { name: /Защитник/ });
    // 4 of 4 are chosen: the other three defenders cannot be ticked.
    const fifth = within(defenders).getByRole("checkbox", { name: /Игрок4/ });
    expect(fifth).toBeDisabled();
    await user.click(within(defenders).getByRole("checkbox", { name: /Игрок0/ }));
    expect(screen.getByRole("button", { name: t.lineupPage.save })).toBeDisabled();
    expect(within(defenders).getByRole("checkbox", { name: /Игрок4/ })).toBeEnabled();
  });

  it("keeps the strongest of each line when the formation changes", async () => {
    form();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(t.lineupPage.formation), "5-3-2");
    expect(screen.getByText(/Выбрано 10 из 11/)).toBeInTheDocument();
    const defenders = screen.getByRole("group", { name: /Защитник/ });
    await user.click(within(defenders).getByRole("checkbox", { name: /Игрок4/ }));
    expect(screen.getByText(/Выбрано 11 из 11/)).toBeInTheDocument();
  });

  it("saves the lineup", async () => {
    form();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(t.lineupPage.mentality), "attack");
    await user.click(screen.getByRole("button", { name: t.lineupPage.save }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/lineup", {
      method: "PUT",
      json: { formation: "4-4-2", mentality: "attack", playerIds: expect.any(Array) },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.lineupPage.savedOk);
  });

  it("says so when the round has started in the meantime", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.lineup_locked", detail: "locked" }),
    );
    form();
    await userEvent.setup().click(screen.getByRole("button", { name: t.lineupPage.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.lineupPage.errors.locked);
  });

  it("cannot be changed once the round is due", () => {
    form({ ...base, locked: true });
    expect(screen.getByText(new RegExp(t.lineupPage.locked))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.lineupPage.save })).toBeDisabled();
    expect(screen.getByLabelText(t.lineupPage.formation)).toBeDisabled();
  });
});
