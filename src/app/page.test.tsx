import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/videos.server", () => ({
  videosService: { getLatestVideos: vi.fn(() => new Promise(() => {})) },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));

const { default: Home } = await import("./page");

describe("Home page", () => {
  it("renders the videos heading and a loading state while videos stream in", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Свежие видео");
    expect(screen.getAllByRole("status", { name: "Загрузка…" }).length).toBeGreaterThan(0);
  });
});
