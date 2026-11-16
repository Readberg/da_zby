import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    lastName: `Игрок${position}${i}`,
    position,
    age: 22,
    citizenship: "BY",
    overall: 60 - i,
    real: 54.8 - i,
    form: 80,
    fitness: 80,
    morale: 80,
    injuredUntil: null,
    trainingFocus: null,
    retiring: false,
    nominal: 1000,
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
  lockAt: "2099-01-01T06:55:00.000Z",
  nextKickoffAt: "2099-01-01T07:00:00.000Z",
};

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ saved: true });
});

const form = (lineup: LineupView = base, over: Partial<PlayerSummary>[] = []) =>
  render(
    <LineupForm
      players={players.map((p) => ({ ...p, ...(over.find((o) => o.id === p.id) ?? {}) }))}
      lineup={lineup}
      until="18.11, 10:00"
    />,
  );

const pitch = () => screen.getByRole("group", { name: t.board.pitch });
/** The round button of a player (the name below it opens his card: that button has no pressed state). */
const chips = (scope: HTMLElement, name: RegExp) =>
  within(scope)
    .queryAllByRole("button", { name })
    .filter((b) => b.hasAttribute("aria-pressed"));
const chipOf = (name: string) => {
  const found = chips(document.body, new RegExp(name));
  if (found.length === 0) throw new Error("no chip " + name);
  return found[0]!;
};
const onPitch = (name: string) => chips(pitch(), new RegExp(name)).length > 0;

describe("LineupForm: the pitch", () => {
  it("puts the eleven on the pitch and the rest on the bench", () => {
    form();
    expect(within(pitch()).getAllByRole("button", { pressed: false })).toHaveLength(11);
    expect(onPitch("ИгрокGK0")).toBe(true);
    expect(onPitch("ИгрокGK1")).toBe(false);
    expect(chipOf("ИгрокGK1")).toBeInTheDocument();
  });

  it("says when the best lineup plays instead and shows a timer to the end of the acceptance", () => {
    form();
    expect(screen.getByText(t.lineupPage.auto)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.lineupPage.lockIn))).toBeInTheDocument();
  });

  it("replaces a player of the pitch by a bench player of the same position: choose, then choose", async () => {
    form();
    const user = userEvent.setup();
    await user.click(chipOf("ИгрокDEF6"));
    await user.click(chipOf("ИгрокDEF0"));
    expect(onPitch("ИгрокDEF6")).toBe(true);
    expect(onPitch("ИгрокDEF0")).toBe(false);
  });

  it("does not move a player to a place of another position", async () => {
    form();
    const user = userEvent.setup();
    await user.click(chipOf("ИгрокMID6"));
    await user.click(chipOf("ИгрокDEF0"));
    // The second click only changes the choice: nobody moved.
    expect(onPitch("ИгрокMID6")).toBe(false);
    expect(onPitch("ИгрокDEF0")).toBe(true);
  });

  it("cancels the choice", async () => {
    form();
    const user = userEvent.setup();
    await user.click(chipOf("ИгрокFWD3"));
    expect(chipOf("ИгрокFWD3")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: t.board.cancel }));
    expect(chipOf("ИгрокFWD3")).toHaveAttribute("aria-pressed", "false");
  });

  it("moves a player with a drag: onto the place of a player of the same position", () => {
    form();
    const bench = chipOf("ИгрокFWD3");
    const target = chips(pitch(), /ИгрокFWD0/)[0]!;
    const place = target.closest("[data-slot]") as HTMLElement;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => place;
    fireEvent.pointerDown(bench, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerMove(bench, { clientX: 60, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(bench, { clientX: 60, clientY: 60, pointerId: 1 });
    document.elementFromPoint = original;
    expect(onPitch("ИгрокFWD3")).toBe(true);
    expect(onPitch("ИгрокFWD0")).toBe(false);
  });

  it("does not drag a player onto the place of another position", () => {
    form();
    const bench = chipOf("ИгрокFWD3");
    const place = chips(pitch(), /ИгрокDEF0/)[0]!.closest("[data-slot]") as HTMLElement;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => place;
    fireEvent.pointerDown(bench, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerMove(bench, { clientX: 60, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(bench, { clientX: 60, clientY: 60, pointerId: 1 });
    document.elementFromPoint = original;
    expect(onPitch("ИгрокFWD3")).toBe(false);
  });

  it("reshapes the pitch when the formation changes", async () => {
    form();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(t.lineupPage.formation), "5-3-2");
    expect(within(pitch()).getAllByRole("button", { pressed: false })).toHaveLength(11);
    expect(onPitch("ИгрокDEF4")).toBe(true);
  });

  it("keeps an injured player on the bench and cannot choose him", () => {
    form({ ...base, playerIds: base.playerIds.filter((id) => id !== "FWD-1") }, [
      { id: "FWD-3", injuredUntil: new Date(Date.now() + 86_400_000).toISOString() },
    ]);
    expect(chipOf("ИгрокFWD3")).toBeDisabled();
  });
});

describe("LineupForm: saving", () => {
  it("saves the eleven in the order of the places", async () => {
    form();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(t.lineupPage.mentality), "attack");
    await user.click(screen.getByRole("button", { name: t.lineupPage.save }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/lineup", {
      method: "PUT",
      json: { formation: "4-4-2", mentality: "attack", playerIds: base.playerIds },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.lineupPage.savedOk);
  });

  it("says so when the acceptance closed in the meantime", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.lineup_locked", detail: "locked" }),
    );
    form();
    await userEvent.setup().click(screen.getByRole("button", { name: t.lineupPage.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.lineupPage.errors.locked);
    expect(screen.getByRole("button", { name: t.lineupPage.save })).toBeDisabled();
  });

  it("cannot be changed once the acceptance is closed", () => {
    form({ ...base, locked: true });
    expect(screen.getByText(t.lineupPage.locked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.lineupPage.save })).toBeDisabled();
    expect(screen.getByLabelText(t.lineupPage.formation)).toBeDisabled();
    expect(chipOf("ИгрокDEF0")).toBeDisabled();
  });
});
