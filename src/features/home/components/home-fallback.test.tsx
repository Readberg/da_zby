import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GuestSlot, SessionKnown } from "./home-fallback";

const guest = <p data-home-guest>guest landing</p>;
const loader = <p>loader</p>;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GuestSlot", () => {
  it("shows the landing that the server already put into the document (first load)", () => {
    // The server-rendered landing is in the page before React takes it over.
    document.body.innerHTML = '<div id="root"><p data-home-guest>guest landing</p></div>';
    render(<GuestSlot guest={guest} loader={loader} />, {
      container: document.getElementById("root")!,
      hydrate: true,
    });
    expect(screen.getByText("guest landing")).toBeVisible();
    expect(screen.queryByText("loader")).toBeNull();
  });

  it("shows a loader after a navigation inside the app, then the landing for a guest", () => {
    // Nothing of the home page is in the document: the visitor came from another page.
    render(<GuestSlot guest={guest} loader={loader} />);
    expect(screen.getByText("loader")).toBeVisible();
    expect(screen.queryByText("guest landing")).toBeNull();

    act(() => {
      render(<SessionKnown member={false} />);
    });
    expect(screen.getByText("guest landing")).toBeVisible();
  });

  it("removes the landing for a signed-in visitor and hides it before hydration", () => {
    render(<GuestSlot guest={guest} loader={loader} />);
    act(() => {
      render(<SessionKnown member />);
    });
    expect(screen.queryByText("guest landing")).toBeNull();
    expect(document.querySelector("style")?.textContent).toContain("[data-home-guest]");
  });
});
