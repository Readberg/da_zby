import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeFallback, HydrationMark } from "./home-fallback";

const guest = <p>guest landing</p>;
const loader = <p>loader</p>;

describe("HomeFallback", () => {
  it("shows the guest landing on the first load and a loader once the app is running", () => {
    // First load: nothing has been hydrated yet.
    const first = render(<HomeFallback guest={guest} loader={loader} />);
    expect(screen.getByText("guest landing")).toBeVisible();
    first.unmount();

    // The layout mounts the mark when the first page has hydrated.
    render(<HydrationMark />);

    // A later navigation to the home page mounts a fresh fallback.
    render(<HomeFallback guest={guest} loader={loader} />);
    expect(screen.getByText("loader")).toBeVisible();
    expect(screen.queryByText("guest landing")).toBeNull();
  });
});
