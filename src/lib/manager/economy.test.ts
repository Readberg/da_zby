import { describe, expect, it } from "vitest";
import {
  ageFactor,
  nominalValue,
  roundMoney,
  roundWages,
  sellerProceeds,
  seasonPrize,
  START_BUDGET,
} from "./economy";

const sum = (entries: { amount: number }[]) => entries.reduce((s, e) => s + e.amount, 0);

describe("nominalValue (the examples of the brief)", () => {
  it("is 1000 for a player of 60 at 24", () => {
    expect(nominalValue(60, 24)).toBe(1000);
  });

  it("is about 3100 at 70 and about 9650 at 80", () => {
    expect(nominalValue(70, 24)).toBe(3106);
    expect(nominalValue(80, 24)).toBe(9646);
  });

  it("rises about 12% with every point of rating", () => {
    expect(nominalValue(61, 24) / nominalValue(60, 24)).toBeCloseTo(1.12, 2);
  });

  it("depends on the age: the young cost more, the old much less", () => {
    expect(ageFactor(20)).toBe(1.3);
    expect(ageFactor(21)).toBe(1.3);
    expect(ageFactor(22)).toBe(1);
    expect(ageFactor(26)).toBe(1);
    expect(ageFactor(27)).toBe(0.8);
    expect(ageFactor(30)).toBe(0.55);
    expect(ageFactor(33)).toBe(0.3);
    expect(nominalValue(60, 19)).toBe(1300);
    expect(nominalValue(60, 35)).toBe(300);
  });
});

describe("a round of money", () => {
  const squad = Array.from({ length: 20 }, () => ({ ovr: 60, age: 24 }));

  it("pays 0.5% of the nominal values: about 100 for the starting squad", () => {
    expect(roundWages(squad)).toBe(100);
  });

  it("a home win brings 120 + 60 + 20 and costs the wages", () => {
    const entries = roundMoney({ home: true, outcome: "win", squad });
    expect(entries).toEqual([
      { reason: "base", amount: 20 },
      { reason: "tickets", amount: 120 },
      { reason: "premium", amount: 60 },
      { reason: "wages", amount: -100 },
    ]);
    expect(sum(entries)).toBe(100);
  });

  it("an away loss brings only the base payment", () => {
    const entries = roundMoney({ home: false, outcome: "loss", squad });
    expect(entries.map((e) => e.reason)).toEqual(["base", "wages"]);
    expect(sum(entries)).toBe(-80);
  });

  it("a draw pays 20", () => {
    expect(
      roundMoney({ home: false, outcome: "draw", squad }).find((e) => e.reason === "premium")
        ?.amount,
    ).toBe(20);
  });
});

describe("seasonPrize", () => {
  it("is 4000 for the first place and 200 for the twentieth", () => {
    expect(seasonPrize(1)).toBe(4000);
    expect(seasonPrize(20)).toBe(200);
    expect(seasonPrize(10)).toBe(2200);
  });

  it("falls by 200 with every place", () => {
    for (let place = 1; place < 20; place += 1) {
      expect(seasonPrize(place) - seasonPrize(place + 1)).toBe(200);
    }
  });
});

describe("sellerProceeds", () => {
  it("takes 10% of the price", () => {
    expect(sellerProceeds(1000, 1000)).toEqual({ tax: 100, payout: 900 });
  });

  it("never pays more than two nominal values, so money cannot be moved by a fake sale", () => {
    expect(sellerProceeds(100_000, 1000)).toEqual({ tax: 10_000, payout: 2000 });
  });
});

describe("the start", () => {
  it("is 10 000 dollars", () => {
    expect(START_BUDGET).toBe(10_000);
  });
});
