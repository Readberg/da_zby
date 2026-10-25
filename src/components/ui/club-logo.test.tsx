import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img {...(props as object)} alt="" />,
}));

const { ClubLogo } = await import("./club-logo");

describe("ClubLogo", () => {
  it("gives every logo the same square frame and shows it whole", () => {
    const { container } = render(<ClubLogo src="https://x/a.webp" name="Динамо" size={32} />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.style.width).toBe("32px");
    expect(frame.style.height).toBe("32px");
    const image = container.querySelector("img")!;
    expect(image.className).toContain("object-contain");
  });

  it("asks for twice the pixels so the logo stays sharp", () => {
    const { container } = render(<ClubLogo src="https://x/a.webp" name="Динамо" size={32} />);
    const image = container.querySelector("img")!;
    expect(image.getAttribute("width")).toBe("64");
    expect(image.getAttribute("height")).toBe("64");
    expect(image.getAttribute("sizes")).toBe("32px");
  });

  it("does not run a local preview through the image optimiser", () => {
    const { container } = render(<ClubLogo src="blob:http://x/1" name="Динамо" size={80} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:http://x/1");
  });

  it("shows the first letter of the club in the same frame when there is no logo", () => {
    const { container } = render(<ClubLogo src={null} name="Нафтан" size={40} />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.textContent).toBe("Н");
    expect(frame.style.width).toBe("40px");
    expect(container.querySelector("img")).toBeNull();
  });
});
