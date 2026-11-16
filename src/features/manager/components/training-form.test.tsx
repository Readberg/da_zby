import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { ru } from "@/messages/ru";
import type { PlayerSummary } from "@/server/api/v1/schemas/manager";

const refresh = vi.fn();
const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { TrainingForm } = await import("./training-form");
const t = ru.manager;

const player = (over: Partial<PlayerSummary>): PlayerSummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  firstName: "Иван",
  lastName: "Новик",
  position: "MID",
  age: 22,
  citizenship: "BY",
  overall: 60,
  real: 54.8,
  form: 80,
  fitness: 80,
  morale: 80,
  injuredUntil: null,
  trainingFocus: null,
  retiring: false,
  ...over,
});

const keeper = player({
  id: "22222222-2222-4222-8222-222222222222",
  lastName: "Рудый",
  position: "GK",
  trainingFocus: "reflexes",
});

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ saved: true });
});

const show = (locked = false) =>
  render(
    <TrainingForm
      t={t}
      players={[player({}), keeper]}
      locked={locked}
      injuredNotes={{ [keeper.id]: "травма до 19.11" }}
    />,
  );

describe("TrainingForm", () => {
  it("offers a goalkeeper his own attributes and an outfield player his", () => {
    show();
    const keeperSelect = screen.getByLabelText(/Рудый/);
    expect(within(keeperSelect).getByRole("option", { name: "Реакция" })).toBeInTheDocument();
    expect(within(keeperSelect).queryByRole("option", { name: "Дриблинг" })).toBeNull();
    const field = screen.getByLabelText(/Новик/);
    expect(within(field).getByRole("option", { name: "Дриблинг" })).toBeInTheDocument();
    expect(within(field).queryByRole("option", { name: "Реакция" })).toBeNull();
    expect(keeperSelect).toHaveValue("reflexes");
    expect(field).toHaveValue("");
  });

  it("shows who is injured", () => {
    show();
    expect(screen.getByText("травма до 19.11")).toBeInTheDocument();
  });

  it("saves every plan: the chosen attribute or null for rest", async () => {
    show();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Новик/), "passing");
    await user.click(screen.getByRole("button", { name: t.trainingPage.save }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/training", {
      method: "PUT",
      json: {
        plans: [
          { playerId: "11111111-1111-4111-8111-111111111111", focus: "passing" },
          { playerId: keeper.id, focus: "reflexes" },
        ],
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.trainingPage.savedOk);
  });

  it("says so when the round has started in the meantime", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.training_locked", detail: "locked" }),
    );
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: t.trainingPage.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.trainingPage.errors.locked);
  });

  it("cannot be changed once the round is due", () => {
    show(true);
    expect(screen.getByText(t.trainingPage.locked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.trainingPage.save })).toBeDisabled();
    expect(screen.getByLabelText(/Новик/)).toBeDisabled();
  });
});
