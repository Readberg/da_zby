import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ru } from "@/messages/ru";

const refresh = vi.fn();
const api = vi.fn();
const upload = vi.fn();
const remove = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload, remove }) } }),
}));

const { LogoUploader } = await import("./logo-uploader");
const t = ru.manager;
const USER = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({ logoUrl: "x" });
  upload.mockReset().mockResolvedValue({ error: null });
  remove.mockReset().mockResolvedValue({ error: null });
});

const choose = (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

describe("LogoUploader", () => {
  it("offers to upload a logo and says what is allowed", () => {
    render(<LogoUploader userId={USER} logoUrl={null} />);
    expect(screen.getByRole("button", { name: t.logo.upload })).toBeInTheDocument();
    expect(screen.getByText(t.logo.hint)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.logo.remove })).toBeNull();
  });

  it("uploads a picture into the own folder and tells the club where it is", async () => {
    render(<LogoUploader userId={USER} logoUrl={null} />);
    choose(new File(["x"], "logo.png", { type: "image/png" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [path] = upload.mock.calls[0] as [string];
    expect(path).toMatch(new RegExp(`^${USER}/club-[0-9a-f-]{36}\\.png$`));
    expect(api).toHaveBeenCalledWith("/manager/club/logo", { method: "PUT", json: { path } });
  });

  it("refuses a file that is not a picture and a file that is too big", async () => {
    render(<LogoUploader userId={USER} logoUrl={null} />);
    choose(new File(["x"], "doc.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.logo.errors.type);
    choose(new File([new Uint8Array(3 * 1024 * 1024)], "big.png", { type: "image/png" }));
    expect(await screen.findByText(t.logo.errors.size)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("replaces a logo and removes the old file", async () => {
    render(
      <LogoUploader
        userId={USER}
        logoUrl={`https://x.supabase.co/storage/v1/object/public/avatars/${USER}/club-old.webp`}
      />,
    );
    expect(screen.getByRole("button", { name: t.logo.replace })).toBeInTheDocument();
    choose(new File(["x"], "logo.webp", { type: "image/webp" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith([`${USER}/club-old.webp`]);
  });

  it("removes the logo", async () => {
    render(
      <LogoUploader
        userId={USER}
        logoUrl={`https://x/storage/v1/object/public/avatars/${USER}/club-old.webp`}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: t.logo.remove }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/manager/club/logo", { method: "PUT", json: { path: null } });
    expect(remove).toHaveBeenCalledWith([`${USER}/club-old.webp`]);
  });

  it("says so when the upload fails", async () => {
    upload.mockResolvedValue({ error: new Error("storage") });
    render(<LogoUploader userId={USER} logoUrl={null} />);
    choose(new File(["x"], "logo.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.logo.errors.upload);
    expect(api).not.toHaveBeenCalled();
  });
});
