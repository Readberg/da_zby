import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { ru } from "@/messages/ru";

const refresh = vi.fn();
const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { CreateClubForm } = await import("./create-club-form");
const t = ru.manager;

const options = {
  cities: [
    { id: 1, name: "Минск" },
    { id: 2, name: "Гомель" },
  ],
  colors: ["#111111", "#222222", "#333333"],
};

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockImplementation(async (path: string) => {
    if (path === "/manager/cities") return options;
    return {};
  });
});

async function ready() {
  render(<CreateClubForm t={t} />);
  await waitFor(() => expect(screen.getByRole("option", { name: "Минск" })).toBeInTheDocument());
}

describe("CreateClubForm", () => {
  it("offers the cities and colours the server returned", async () => {
    await ready();
    expect(screen.getAllByRole("button", { name: /Цвет \d/ })).toHaveLength(6);
    expect(screen.getByText(t.countries.BY)).toBeInTheDocument();
  });

  it("refuses a bad name or a missing city before it asks the server", async () => {
    await ready();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.nameInvalid);

    await user.type(screen.getByLabelText(t.nameLabel), "Dinamo!");
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.nameInvalid);

    await user.clear(screen.getByLabelText(t.nameLabel));
    await user.type(screen.getByLabelText(t.nameLabel), "Динамо Минск");
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.cityRequired);
    expect(api).not.toHaveBeenCalledWith("/manager/club", expect.anything());
  });

  it("makes the club and refreshes the page", async () => {
    await ready();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t.nameLabel), "Динамо Минск");
    await user.selectOptions(screen.getByLabelText(t.cityLabel), "Гомель");
    await user.click(screen.getByRole("button", { name: t.submit }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/club", {
      method: "POST",
      json: {
        name: "Динамо Минск",
        cityId: 2,
        primaryColor: "#111111",
        secondaryColor: "#333333",
      },
    });
  });

  it("says that the name is taken", async () => {
    api.mockImplementation(async (path: string) => {
      if (path === "/manager/cities") return options;
      throw new ApiClientError({ status: 409, code: "manager.name_taken", detail: "taken" });
    });
    render(<CreateClubForm t={t} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "Минск" })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t.nameLabel), "Динамо");
    await user.selectOptions(screen.getByLabelText(t.cityLabel), "Минск");
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.nameTaken);
    expect(refresh).not.toHaveBeenCalled();
  });
});
