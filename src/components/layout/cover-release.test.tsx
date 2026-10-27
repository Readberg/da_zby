import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverRelease } from "./cover-release";

afterEach(() => {
  document.documentElement.removeAttribute("data-ready");
  vi.useRealTimers();
});

describe("CoverRelease", () => {
  it("marks the page ready once the fonts are in", async () => {
    render(<CoverRelease />);
    await vi.waitFor(() => expect(document.documentElement).toHaveAttribute("data-ready"));
  });

  it("leaves a page alone that the inline script has already marked", () => {
    document.documentElement.setAttribute("data-ready", "script");
    render(<CoverRelease />);
    expect(document.documentElement.getAttribute("data-ready")).toBe("script");
  });

  it("does not mark anything after it was removed", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "fonts", {
      value: { ready: new Promise(() => {}) },
      configurable: true,
    });
    const { unmount } = render(<CoverRelease />);
    unmount();
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.documentElement).not.toHaveAttribute("data-ready");
    Reflect.deleteProperty(document, "fonts");
  });
});
