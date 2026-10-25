import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cache invalidation needs the Next.js runtime; tests assert the calls instead.
vi.mock("@/server/cache", () => ({ invalidateRating: vi.fn() }));

// jsdom does not implement scrolling; components call it on user actions.
if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});
