import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { ru } from "@/messages/ru";

const refresh = vi.fn();
const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { BuyButton } = await import("./buy-button");
const t = ru.manager;

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ budget: 9000 });
});

const show = (disabled = false) => render(<BuyButton t={t} playerId="p-1" disabled={disabled} />);

describe("BuyButton", () => {
  it("buys the player and refreshes the page", async () => {
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: t.market.buy }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/market/buy", {
      method: "POST",
      json: { playerId: "p-1" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.market.bought);
  });

  it.each([
    ["manager.market_closed", t.market.errors.closed],
    ["manager.player_unavailable", t.market.errors.unavailable],
    ["manager.squad_full", t.market.errors.full],
    ["manager.no_money", t.market.errors.noMoney],
  ])("says why it could not buy: %s", async (code, text) => {
    api.mockRejectedValue(new ApiClientError({ status: 409, code, detail: "no" }));
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: t.market.buy }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("is switched off when the club cannot buy", () => {
    show(true);
    expect(screen.getByRole("button", { name: t.market.buy })).toBeDisabled();
  });
});
