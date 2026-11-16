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

const { BidForm } = await import("./bid-form");
const { CancelLotButton } = await import("./cancel-lot-button");
const { TradeButtons } = await import("./trade-buttons");
const { ContractActions } = await import("./contract-actions");
const t = ru.manager;

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({});
});

describe("BidForm", () => {
  it("starts from the least bid and sends the amount", async () => {
    render(<BidForm t={t} auctionId="a1" minBid={1200} disabled={false} />);
    const input = screen.getByLabelText(t.auction.amountLabel);
    expect(input).toHaveValue(1200);
    await userEvent.setup().click(screen.getByRole("button", { name: t.auction.bid }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/auctions/bid", {
      method: "POST",
      json: { auctionId: "a1", amount: 1200 },
    });
    expect(screen.getByRole("status")).toHaveTextContent(t.auction.placed);
  });

  it("says in words why a bid was refused", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.bid_too_low", detail: "x" }),
    );
    render(<BidForm t={t} auctionId="a1" minBid={1200} disabled={false} />);
    await userEvent.setup().click(screen.getByRole("button", { name: t.auction.bid }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.auction.errors.tooLow);
  });

  it("cannot be sent when the club cannot bid", () => {
    render(<BidForm t={t} auctionId="a1" minBid={1200} disabled />);
    expect(screen.getByRole("button", { name: t.auction.bid })).toBeDisabled();
  });
});

describe("CancelLotButton", () => {
  it("takes the lot off, and is shut once there is a bid", async () => {
    const { rerender } = render(<CancelLotButton t={t} auctionId="a1" disabled={false} />);
    await userEvent.setup().click(screen.getByRole("button", { name: t.auction.cancel }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/auctions/cancel", {
      method: "POST",
      json: { auctionId: "a1" },
    });
    rerender(<CancelLotButton t={t} auctionId="a1" disabled />);
    expect(screen.getByRole("button", { name: t.auction.cancel })).toBeDisabled();
    expect(screen.getByText(t.auction.cannotCancel)).toBeInTheDocument();
  });
});

describe("TradeButtons", () => {
  it("accepts and declines an offer to my club", async () => {
    render(<TradeButtons t={t} tradeId="x1" incoming />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.trade.accept }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenLastCalledWith("/manager/trades/accept", {
      method: "POST",
      json: { tradeId: "x1" },
    });
    await user.click(screen.getByRole("button", { name: t.trade.decline }));
    expect(api).toHaveBeenLastCalledWith("/manager/trades/decline", {
      method: "POST",
      json: { tradeId: "x1" },
    });
  });

  it("lets me withdraw my own offer only", async () => {
    render(<TradeButtons t={t} tradeId="x1" incoming={false} />);
    expect(screen.queryByRole("button", { name: t.trade.accept })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: t.trade.withdraw }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/manager/trades/cancel", {
        method: "POST",
        json: { tradeId: "x1" },
      }),
    );
  });

  it("explains an offer that is no longer open", async () => {
    api.mockRejectedValue(
      new ApiClientError({ status: 409, code: "manager.trade_closed", detail: "x" }),
    );
    render(<TradeButtons t={t} tradeId="x1" incoming />);
    await userEvent.setup().click(screen.getByRole("button", { name: t.trade.accept }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.trade.errors.tradeClosed);
  });
});

describe("ContractActions", () => {
  const player = {
    id: "p1",
    firstName: "Иван",
    lastName: "Новик",
    position: "MID" as const,
    age: 24,
    overall: 60,
    nominal: 1000,
    wage: 5,
    contractUntil: 3,
    roundsLeft: 60,
    tradableAfter: null,
    onAuction: false,
    retiring: false,
    canSell: true,
    sellBlock: null,
    canExtend: true,
    breakPenalty: 200,
    priceMin: 500,
    priceMax: 2000,
  };

  it("puts a player up with a price and a step", async () => {
    api.mockResolvedValue({ auctionId: "a1", endsAt: "2026-11-26T07:00:00.000Z" });
    render(<ContractActions t={t} player={player} locale="ru" offsetMinutes={180} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.contracts.sell }));
    await user.click(screen.getByRole("button", { name: t.contracts.list }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/auctions", {
      method: "POST",
      json: { playerId: "p1", price: 1000, stepPercent: 20 },
    });
  });

  it("tells the answer of the player to an offer of a contract", async () => {
    api.mockResolvedValue({ result: "refused" });
    render(<ContractActions t={t} player={player} locale="ru" offsetMinutes={180} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.contracts.extend }));
    await user.click(screen.getByRole("button", { name: t.contracts.offer }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.contracts.refused);
  });

  it("asks for a confirmation before breaking a contract and shows the penalty", async () => {
    api.mockResolvedValue({ penalty: 200 });
    render(<ContractActions t={t} player={player} locale="ru" offsetMinutes={180} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.contracts.terminate }));
    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("button", { name: t.contracts.terminate })[1]!);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/contracts/terminate", {
      method: "POST",
      json: { playerId: "p1" },
    });
  });

  it("explains why a player cannot be put up", () => {
    render(
      <ContractActions
        t={t}
        player={{ ...player, canSell: false, sellBlock: "locked" }}
        locale="ru"
        offsetMinutes={180}
      />,
    );
    expect(screen.getByRole("button", { name: t.contracts.sell })).toBeDisabled();
    expect(screen.getByText(t.contracts.blocks.locked)).toBeInTheDocument();
  });
});
