import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorReporter } from "./error-reporter";

type UmamiWindow = { umami?: { track: ReturnType<typeof vi.fn> } };
const w = window as unknown as UmamiWindow;

beforeEach(() => {
  w.umami = { track: vi.fn() };
});
afterEach(() => {
  delete w.umami;
});

describe("ErrorReporter", () => {
  it("reports a browser error once, with a short message and the path only", () => {
    render(<ErrorReporter />);
    const error = new Error("Something broke");
    window.dispatchEvent(new ErrorEvent("error", { error }));
    window.dispatchEvent(new ErrorEvent("error", { error }));
    expect(w.umami!.track).toHaveBeenCalledTimes(1);
    expect(w.umami!.track).toHaveBeenCalledWith("client-error", {
      message: "Something broke",
      path: "/",
    });
  });

  it("ignores the detail-less errors of other people's scripts", () => {
    render(<ErrorReporter />);
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    expect(w.umami!.track).not.toHaveBeenCalled();
  });

  it("reports unhandled promise rejections too", () => {
    render(<ErrorReporter />);
    const event = new Event("unhandledrejection") as Event & { reason: unknown };
    event.reason = new Error("rejected");
    window.dispatchEvent(event);
    expect(w.umami!.track).toHaveBeenCalledWith(
      "client-error",
      expect.objectContaining({ message: "rejected" }),
    );
  });

  it("sends only a few reports per page, so one broken screen cannot flood the stats", () => {
    render(<ErrorReporter />);
    for (let i = 0; i < 20; i++)
      window.dispatchEvent(new ErrorEvent("error", { error: new Error(`failure ${i}`) }));
    expect(w.umami!.track).toHaveBeenCalledTimes(5);
  });
});
