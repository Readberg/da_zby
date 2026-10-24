import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { ProfileForm } = await import("./profile-form");

const initial = {
  fullName: "",
  contact: "",
  about: "",
  countryCode: "",
  city: "",
  utcOffsetMinutes: 180,
};
const countries = [
  { code: "BY", name: "Беларусь" },
  { code: "PL", name: "Польша" },
];

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({});
});

describe("ProfileForm", () => {
  it("starts with UTC+3 and an empty country", () => {
    render(<ProfileForm initial={initial} countries={countries} />);
    expect(screen.getByLabelText("Часовой пояс")).toHaveValue("180");
    expect(screen.getByLabelText("Страна")).toHaveValue("");
  });

  it("counts characters of the about field", async () => {
    render(<ProfileForm initial={initial} countries={countries} />);
    await userEvent.type(screen.getByLabelText("О себе"), "Привет");
    expect(screen.getByText("6/1000")).toBeVisible();
  });

  it("saves all editable fields through PATCH /me and refreshes the page", async () => {
    render(<ProfileForm initial={initial} countries={countries} />);
    await userEvent.type(screen.getByLabelText("Имя"), "Роман");
    await userEvent.selectOptions(screen.getByLabelText("Страна"), "BY");
    await userEvent.type(screen.getByLabelText("Город"), "Минск");
    await userEvent.selectOptions(screen.getByLabelText("Часовой пояс"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(api).toHaveBeenCalledWith("/me", {
      method: "PATCH",
      json: {
        fullName: "Роман",
        contact: "",
        about: "",
        countryCode: "BY",
        city: "Минск",
        utcOffsetMinutes: 120,
      },
    });
    expect(await screen.findByText("Сохранено")).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it("does not call the API when a value is too long and names the field", async () => {
    render(<ProfileForm initial={{ ...initial, about: "x".repeat(1001) }} countries={countries} />);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText("Не длиннее 1000 символов")).toBeVisible();
    expect(screen.getByText(/Не удалось сохранить/)).toBeVisible();
  });

  it("shows server-side field errors", async () => {
    api.mockRejectedValue(
      new ApiClientError({
        status: 422,
        code: "api.validation_failed",
        errors: [{ field: "city", message: "Слишком длинное название" }],
      }),
    );
    render(<ProfileForm initial={initial} countries={countries} />);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Слишком длинное название")).toBeVisible();
  });
});
