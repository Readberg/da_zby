import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ru } from "@/messages/ru";

const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { CreateClubForm, COLOR_COOLDOWN_MS } = await import("./create-club-form");
const t = ru.manager;

const options = {
  cities: [{ id: 1, name: "Минск" }],
  colors: ["#111111", "#222222", "#333333", "#444444"],
};

beforeEach(() => {
  api
    .mockReset()
    .mockImplementation(async (path: string) => (path === "/manager/cities" ? options : {}));
});

async function ready() {
  const view = render(<CreateClubForm />);
  await waitFor(() => expect(screen.getByRole("option", { name: "Минск" })).toBeInTheDocument());
  return view;
}

/** The colours of the shirt and of the shorts, as the browser reports them. */
const kit = (container: HTMLElement) => {
  const paths = [...container.querySelectorAll("svg path")] as SVGPathElement[];
  return { shorts: paths[0]!.style.fill, shirt: paths[1]!.style.fill };
};

describe("the kit in the form of a club", () => {
  it("shows a shirt and shorts in the first and the last colour of the palette", async () => {
    const { container } = await ready();
    expect(screen.getByRole("img", { name: t.kitLabel })).toBeInTheDocument();
    expect(kit(container)).toEqual({ shirt: "rgb(17, 17, 17)", shorts: "rgb(68, 68, 68)" });
  });

  it("changes the colour of the shirt and of the shorts with the choice", async () => {
    const { container } = await ready();
    const main = screen.getByRole("group", { name: t.primaryColor });
    fireEvent.click(main.querySelectorAll("button")[1]!);
    expect(kit(container).shirt).toBe("rgb(34, 34, 34)");
    await new Promise((resolve) => setTimeout(resolve, COLOR_COOLDOWN_MS + 50));
    const second = screen.getByRole("group", { name: t.secondaryColor });
    fireEvent.click(second.querySelectorAll("button")[2]!);
    expect(kit(container).shorts).toBe("rgb(51, 51, 51)");
  });

  it("ignores a quick succession of clicks: one colour in a quarter of a second", async () => {
    const { container } = await ready();
    const main = screen.getByRole("group", { name: t.primaryColor });
    const buttons = main.querySelectorAll("button");
    fireEvent.click(buttons[1]!);
    fireEvent.click(buttons[2]!);
    fireEvent.click(buttons[3]!);
    expect(kit(container).shirt).toBe("rgb(34, 34, 34)");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    await new Promise((resolve) => setTimeout(resolve, COLOR_COOLDOWN_MS + 50));
    fireEvent.click(buttons[3]!);
    expect(kit(container).shirt).toBe("rgb(68, 68, 68)");
  });

  it("leads to the FAQ from the form", async () => {
    await ready();
    expect(screen.getByRole("link", { name: t.faqLink })).toHaveAttribute("href", "/manager/faq");
  });
});
