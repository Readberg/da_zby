import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

const { NavigationProgress } = await import("./navigation-progress");

function link(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement("a");
  a.href = href;
  for (const [key, value] of Object.entries(attrs)) a.setAttribute(key, value);
  document.body.appendChild(a);
  return a;
}

const active = () => screen.getByTestId("navigation-progress").dataset.active === "true";

beforeEach(() => {
  pathname.value = "/";
  document.body.replaceChildren();
});

describe("NavigationProgress", () => {
  it("starts when an internal link to another page is clicked", () => {
    const view = render(<NavigationProgress />);
    expect(active()).toBe(false);
    act(() => link("/profile").click());
    expect(active()).toBe(true);

    pathname.value = "/profile";
    view.rerender(<NavigationProgress />);
    expect(active()).toBe(false);
  });

  it("ignores external links, new tabs and links to the current page", () => {
    render(<NavigationProgress />);
    act(() => link("https://example.com/").click());
    act(() => link("/profile", { target: "_blank" }).click());
    act(() => link("/").click());
    expect(active()).toBe(false);
  });
});
