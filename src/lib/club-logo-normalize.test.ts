import { describe, expect, it } from "vitest";
import { fitIntoSquare, normalizeClubLogo } from "./club-logo-normalize";

describe("fitIntoSquare", () => {
  it("scales a big square logo down to the limit", () => {
    expect(fitIntoSquare(1000, 1000)).toEqual({
      side: 256,
      drawWidth: 256,
      drawHeight: 256,
      x: 0,
      y: 0,
    });
  });

  it("keeps the proportions of a wide logo and centres it vertically", () => {
    const fit = fitIntoSquare(800, 400);
    expect(fit).toMatchObject({ side: 256, drawWidth: 256, drawHeight: 128, x: 0, y: 64 });
  });

  it("keeps the proportions of a tall logo and centres it horizontally", () => {
    const fit = fitIntoSquare(300, 600);
    expect(fit).toMatchObject({ side: 256, drawWidth: 128, drawHeight: 256, x: 64, y: 0 });
  });

  it("never enlarges a small logo: the canvas follows its longest side", () => {
    const fit = fitIntoSquare(100, 60);
    expect(fit).toMatchObject({ side: 100, drawWidth: 100, drawHeight: 60, x: 0, y: 20 });
  });

  it("copes with degenerate sizes", () => {
    const fit = fitIntoSquare(1, 1);
    expect(fit.side).toBe(1);
    expect(fit.drawWidth).toBe(1);
  });
});

describe("normalizeClubLogo", () => {
  it("returns the original file when the browser cannot process images", async () => {
    const file = new File([new Uint8Array(10)], "club.png", { type: "image/png" });
    await expect(normalizeClubLogo(file)).resolves.toBe(file);
  });
});
