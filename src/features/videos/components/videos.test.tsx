import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VideosUnavailableError, type Video } from "@/server/services/videos";
import { LatestVideos } from "./latest-videos";
import { VideoShowcase } from "./video-showcase";

// Previews are decorative (alt=""); image optimisation is not under test here.
vi.mock("next/image", () => ({ default: () => null }));

const videos: Video[] = Array.from({ length: 6 }, (_, i) => ({
  id: `video${i}abcd`.slice(0, 11),
  title: `Выпуск ${i + 1}`,
  publishedAt: `2026-10-${String(23 - i).padStart(2, "0")}T12:00:00.000Z`,
  thumbnailUrl: `https://i.ytimg.com/vi/video${i}/hqdefault.jpg`,
  url: `https://www.youtube.com/watch?v=video${i}`,
}));

describe("VideoShowcase", () => {
  it("shows the cover of the newest video and loads no player until the click", async () => {
    const { container } = render(<VideoShowcase videos={videos} />);
    expect(container.querySelector("iframe")).toBeNull();
    const play = screen.getByRole("button", { name: "Смотреть видео: Выпуск 1" });
    expect(screen.getByRole("heading", { name: "Выпуск 1" })).toBeInTheDocument();
    expect(screen.getByText("23 октября 2026")).toBeInTheDocument();

    await userEvent.click(play);
    const player = screen.getByTitle("Видеоплеер YouTube: Выпуск 1");
    expect(player.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${videos[0]!.id}?rel=0&autoplay=1`,
    );
    expect(container.querySelector("iframe")).toBe(player);
    expect(screen.queryByRole("button", { name: /Смотреть видео:/ })).toBeNull();
  });

  it("lists the five previous videos", () => {
    render(<VideoShowcase videos={videos} />);
    const more = screen.getByRole("region", { name: "Предыдущие выпуски" });
    expect(within(more).getAllByRole("listitem")).toHaveLength(5);
  });

  it("starts a video picked from the grid at once", async () => {
    render(<VideoShowcase videos={videos} />);
    await userEvent.click(screen.getByRole("button", { name: /^Выпуск 3/ }));

    const player = screen.getByTitle("Видеоплеер YouTube: Выпуск 3");
    expect(player.getAttribute("src")).toContain("autoplay=1");
    expect(screen.getByRole("heading", { name: "Выпуск 3" })).toBeInTheDocument();
    const more = screen.getByRole("region", { name: "Предыдущие выпуски" });
    expect(within(more).queryByText("Выпуск 3")).toBeNull();
    expect(within(more).getByText("Выпуск 1")).toBeInTheDocument();
  });

  it("links to the video on YouTube", () => {
    render(<VideoShowcase videos={videos} />);
    expect(screen.getByRole("link", { name: /Смотреть на YouTube/ })).toHaveAttribute(
      "href",
      videos[0]!.url,
    );
  });
});

describe("LatestVideos", () => {
  it("asks for four videos: the main one and three beside it", async () => {
    const loadVideos = vi.fn(async () => videos);
    render(await LatestVideos({ loadVideos }));
    expect(loadVideos).toHaveBeenCalledWith(4);
    expect(screen.getByRole("button", { name: "Смотреть видео: Выпуск 1" })).toBeInTheDocument();
  });

  it("shows the fallback with a channel link when YouTube is unavailable", async () => {
    render(
      await LatestVideos({
        loadVideos: async () => {
          throw new VideosUnavailableError();
        },
      }),
    );
    expect(screen.getByRole("heading", { name: "Видео сейчас не загрузились" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Перейти на канал/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@da_zby",
    );
  });

  it("shows the fallback for an empty list", async () => {
    render(await LatestVideos({ loadVideos: async () => [] }));
    expect(screen.getByRole("link", { name: /Перейти на канал/ })).toBeInTheDocument();
  });

  it("does not swallow unexpected errors", async () => {
    await expect(
      LatestVideos({
        loadVideos: async () => {
          throw new Error("bug");
        },
      }),
    ).rejects.toThrow("bug");
  });
});
