import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("renders the final value in the markup", () => {
    render(<CountUp value={12} />);
    expect(screen.getByText("12")).toBeVisible();
  });

  it("keeps zero as zero", () => {
    render(<CountUp value={0} />);
    expect(screen.getByText("0")).toBeVisible();
  });
});
