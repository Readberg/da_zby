import { describe, expect, it } from "vitest";
import { canOfferContract, contractRoundsLeft, sellBlock } from "./contract";
import {
  breakPenalty,
  contractWage,
  minNextBid,
  nominalValue,
  roundWages,
  sellerProceeds,
  startPriceRange,
} from "./economy";

describe("contractRoundsLeft", () => {
  it("counts what is left of this season and the whole seasons after it", () => {
    expect(contractRoundsLeft({ contractUntil: 2, season: 2, playedThisSeason: 10 })).toBe(28);
    expect(contractRoundsLeft({ contractUntil: 3, season: 2, playedThisSeason: 10 })).toBe(66);
    expect(contractRoundsLeft({ contractUntil: 2, season: 2, playedThisSeason: 38 })).toBe(0);
  });

  it("is zero for a contract that is over", () => {
    expect(contractRoundsLeft({ contractUntil: 1, season: 2, playedThisSeason: 0 })).toBe(0);
  });
});

describe("canOfferContract", () => {
  it("is allowed from half a season to two seasons left, once a season", () => {
    expect(canOfferContract(18, null, 2)).toBe(false);
    expect(canOfferContract(19, null, 2)).toBe(true);
    expect(canOfferContract(76, null, 2)).toBe(true);
    expect(canOfferContract(77, null, 2)).toBe(false);
    expect(canOfferContract(40, 2, 2)).toBe(false);
    expect(canOfferContract(40, 1, 2)).toBe(true);
  });
});

describe("sellBlock", () => {
  const ok = {
    marketOpen: true,
    onAuction: false,
    retiring: false,
    tradableAfter: null,
    roundsLeft: 30,
    openLots: 0,
    squadSize: 20,
    now: new Date("2026-11-25T10:00:00Z"),
  };

  it("lets a player of a healthy squad go", () => {
    expect(sellBlock(ok)).toBeNull();
  });

  it.each([
    [{ marketOpen: false }, "market_closed"],
    [{ onAuction: true }, "on_auction"],
    [{ retiring: true }, "retiring"],
    [{ tradableAfter: new Date("2026-11-26T10:00:00Z") }, "locked"],
    [{ roundsLeft: 18 }, "contract_ending"],
    [{ openLots: 5 }, "lots_limit"],
    [{ squadSize: 17 }, "squad_min"],
    [{ squadSize: 19, openLots: 2 }, "squad_min"],
  ])("explains %j with %s", (change, reason) => {
    expect(sellBlock({ ...ok, ...change })).toBe(reason);
  });

  it("lets a player go once his week is over", () => {
    expect(sellBlock({ ...ok, tradableAfter: new Date("2026-11-25T09:00:00Z") })).toBeNull();
  });
});

describe("the numbers of the market", () => {
  it("asks for the start price, then the best bid and the step", () => {
    expect(minNextBid(1000, null, 20)).toBe(1000);
    expect(minNextBid(1000, 1000, 10)).toBe(1100);
    expect(minNextBid(1000, 1234, 30)).toBe(1234 + 371);
    expect(minNextBid(1, 1, 10)).toBe(2);
  });

  it("starts from half to twice the nominal value", () => {
    expect(startPriceRange(1000)).toEqual({ min: 500, max: 2000 });
    expect(startPriceRange(nominalValue(70, 24))).toEqual({ min: 1553, max: 6212 });
  });

  it("charges two thirds of the wages left for breaking a contract", () => {
    expect(breakPenalty(30, 100)).toBe(2000);
    expect(breakPenalty(0, 100)).toBe(0);
  });

  it("fixes the wage in a contract and pays that, not the nominal value of today", () => {
    expect(contractWage(60, 24)).toBe(5);
    expect(
      roundWages([
        { ovr: 80, age: 24, wage: 5 },
        { ovr: 60, age: 24, wage: 5 },
      ]),
    ).toBe(10);
    expect(roundWages([{ ovr: 60, age: 24 }])).toBe(5);
  });

  it("agrees with the database on what a seller gets", () => {
    // 2.4 nominal values: the tax is 10%, the cap 2 nominal values (the check in the SQL run)
    expect(sellerProceeds(2400, 1000)).toEqual({ tax: 240, payout: 2000 });
    expect(sellerProceeds(1000, 1000)).toEqual({ tax: 100, payout: 900 });
  });
});
