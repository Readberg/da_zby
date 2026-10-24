import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, api, upload, remove } = vi.hoisted(() => ({
  refresh: vi.fn(),
  api: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api-client", () => ({ api }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload, remove }) } }),
}));
vi.mock("next/image", () => ({ default: () => null }));

const { AvatarUploader } = await import("./avatar-uploader");

const USER = "123e4567-e89b-12d3-a456-426614174000";
const props = { userId: USER, nickname: "Readberg", currentUrl: null, currentPath: null };
const file = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });
const choose = (f: File) =>
  userEvent.upload(screen.getByLabelText("Выбрать фото", { selector: "input" }), f, {
    applyAccept: false,
  });

beforeEach(() => {
  refresh.mockReset();
  api.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue({ error: null });
  remove.mockReset().mockResolvedValue({ error: null });
});

describe("AvatarUploader", () => {
  it("rejects a wrong type or a big file before uploading anything", async () => {
    render(<AvatarUploader {...props} />);
    await choose(file("a.gif", "image/gif"));
    expect(screen.getByRole("alert")).toHaveTextContent("Подходят только JPEG, PNG и WebP.");
    await choose(file("big.png", "image/png", 2 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent("Файл больше 2 МБ.");
    expect(upload).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("uploads into the user's own folder, attaches the path and refreshes", async () => {
    render(<AvatarUploader {...props} />);
    await choose(file("me.png", "image/png"));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const path = upload.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^${USER}/[\\w-]+\\.png$`));
    expect(upload.mock.calls[0]![2]).toMatchObject({ contentType: "image/png", upsert: false });
    expect(api).toHaveBeenCalledWith("/me", { method: "PATCH", json: { avatarPath: path } });
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the previous file after a successful replacement", async () => {
    render(
      <AvatarUploader {...props} currentUrl="https://x/y.png" currentPath={`${USER}/old.png`} />,
    );
    await choose(file("new.webp", "image/webp"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith([`${USER}/old.png`]));
  });

  it("keeps the old photo and says so when the upload fails", async () => {
    upload.mockResolvedValue({ error: { message: "nope" } });
    render(
      <AvatarUploader {...props} currentUrl="https://x/y.png" currentPath={`${USER}/old.png`} />,
    );
    await choose(file("new.png", "image/png"));
    expect(await screen.findByText("Не удалось загрузить фото. Попробуйте ещё раз.")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the photo through the API and then the file", async () => {
    render(
      <AvatarUploader {...props} currentUrl="https://x/y.png" currentPath={`${USER}/old.png`} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Удалить фото" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/me", { method: "PATCH", json: { avatarPath: null } });
    expect(remove).toHaveBeenCalledWith([`${USER}/old.png`]);
  });

  it("offers no removal when there is no photo", () => {
    render(<AvatarUploader {...props} />);
    expect(screen.queryByRole("button", { name: "Удалить фото" })).not.toBeInTheDocument();
  });
});
