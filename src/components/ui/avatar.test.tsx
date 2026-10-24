import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => <span data-testid="photo" data-src={src} />,
}));

const { Avatar } = await import("./avatar");

describe("Avatar", () => {
  it("shows the photo when there is one", () => {
    render(<Avatar src="https://example.com/a.png" name="Readberg" />);
    expect(screen.getByTestId("photo")).toHaveAttribute("data-src", "https://example.com/a.png");
  });

  it("falls back to the first letter, hidden from screen readers", () => {
    const { container } = render(<Avatar name="  баранки" />);
    const fallback = container.querySelector("span[aria-hidden='true']")!;
    expect(fallback).toHaveTextContent("б");
  });

  it("copes with an empty name", () => {
    const { container } = render(<Avatar name="" />);
    expect(container.querySelector("span[aria-hidden='true']")).toHaveTextContent("?");
  });
});
