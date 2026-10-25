import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { RoleButton } = await import("./role-button");
const { ApiClientError } = await import("@/lib/api-client");

const ID = "11111111-1111-4111-8111-111111111112";

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({});
});

describe("RoleButton", () => {
  it("offers to grant the role to a user and refreshes after saving", async () => {
    render(<RoleButton userId={ID} role="user" nickname="Petya" />);
    await userEvent.click(screen.getByRole("button", { name: /Сделать админом/ }));

    expect(api).toHaveBeenCalledWith("/admin/users/role", {
      method: "PATCH",
      json: { userId: ID, role: "admin" },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("offers to revoke the role from an admin", async () => {
    render(<RoleButton userId={ID} role="admin" nickname="Petya" />);
    await userEvent.click(screen.getByRole("button", { name: /Снять админа/ }));
    expect(api).toHaveBeenCalledWith("/admin/users/role", {
      method: "PATCH",
      json: { userId: ID, role: "user" },
    });
  });

  it("explains the last-admin rule", async () => {
    api.mockRejectedValue(new ApiClientError({ status: 409, code: "admin.last_admin" }));
    render(<RoleButton userId={ID} role="admin" nickname="Petya" />);
    await userEvent.click(screen.getByRole("button", { name: /Снять админа/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("последнего админа");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic message for other failures", async () => {
    api.mockRejectedValue(new Error("network"));
    render(<RoleButton userId={ID} role="user" nickname="Petya" />);
    await userEvent.click(screen.getByRole("button", { name: /Сделать админом/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось изменить роль");
  });
});
