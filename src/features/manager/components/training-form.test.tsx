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
  nominal: 1000,
  ...over,
});

const mid1 = player({});
const mid2 = player({ id: "33333333-3333-4333-8333-333333333333", lastName: "Рудый" });
const keeper = player({
  id: "22222222-2222-4222-8222-222222222222",
  lastName: "Вратарёв",
  position: "GK",
  trainingFocus: "kicking",
});

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ saved: true });
});

const show = (locked = false) =>
  render(
    <TrainingForm
      players={[mid1, mid2, keeper]}
      locked={locked}
      injuredNotes={{ [keeper.id]: "травма до 19.11" }}
    />,
  );

const line = (name: RegExp) => screen.getByRole("region", { name });
const own = (name: string) =>
  screen.getByLabelText(new RegExp(`${t.trainingPage.individual}: .*${name}`));

describe("TrainingForm", () => {
  it("is sorted by position, with the main training of each position on top", () => {
    show();
    expect(line(/Вратари/)).toBeInTheDocument();
    expect(line(/Полузащитники/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Защитники/ })).toBeNull();
  });

  it("proposes the recommended training where nobody trains yet and the common one elsewhere", () => {
    show();
    const mid = within(line(/Полузащитники/)).getByLabelText(t.trainingPage.primary);
    expect(mid).toHaveValue("passing");
    const gk = within(line(/Вратари/)).getByLabelText(t.trainingPage.primary);
    expect(gk).toHaveValue("kicking");
  });

  it("marks the recommended attribute", () => {
    show();
    const mid = within(line(/Полузащитники/)).getByLabelText(t.trainingPage.primary);
    expect(within(mid).getByRole("option", { name: /Пас · рекомендуем/ })).toBeInTheDocument();
  });

  it("sets the main training for the whole line at once", async () => {
    show();
    const user = userEvent.setup();
    const mid = within(line(/Полузащитники/)).getByLabelText(t.trainingPage.primary);
    await user.selectOptions(mid, "vision");
    expect(own("Новик")).toHaveValue("vision");
    expect(own("Рудый")).toHaveValue("vision");
  });

  it("lets a single player train something else and says so", async () => {
    show();
    const user = userEvent.setup();
    await user.selectOptions(own("Рудый"), "stamina");
    expect(own("Рудый")).toHaveValue("stamina");
    expect(own("Новик")).toHaveValue("passing");
    expect(screen.getAllByText(t.trainingPage.individualMark)).toHaveLength(1);
  });

  it("offers a goalkeeper his own attributes only", () => {
    show();
    const select = own("Вратарёв");
    expect(within(select).getByRole("option", { name: "Реакция" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Дриблинг" })).toBeNull();
  });

  it("shows who is injured", () => {
    show();
    expect(screen.getByText("травма до 19.11")).toBeInTheDocument();
  });

  it("saves every plan: the chosen attribute or null for rest", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.trainingPage.save }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/training", {
      method: "PUT",
      json: {
        plans: [
          { playerId: mid1.id, focus: "passing" },
          { playerId: mid2.id, focus: "passing" },
          { playerId: keeper.id, focus: "kicking" },
        ],
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.trainingPage.savedOk);
  });

  it("says so when the acceptance closed in the meantime", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.training_locked", detail: "locked" }),
    );
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: t.trainingPage.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.trainingPage.errors.locked);
  });

  it("cannot be changed once the acceptance is closed", () => {
    show(true);
    expect(screen.getByText(t.trainingPage.locked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.trainingPage.save })).toBeDisabled();
    expect(own("Новик")).toBeDisabled();
  });
});
