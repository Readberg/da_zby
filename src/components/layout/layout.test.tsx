import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { SiteHeader } = await import("./site-header");
const { SiteFooter } = await import("./site-footer");
const { siteConfig } = await import("@/config/site");

describe("SiteHeader", () => {
  it("links the logo to the home page", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "«Да забей» — на главную" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows only existing pages and marks the current one", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Главная"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });
});

describe("SiteFooter", () => {
  it("shows YouTube and hides socials without a URL", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Мы в соцсетях" });
    const links = within(nav).getAllByRole("link");
    const configured = siteConfig.social.filter((s) => s.url).length;
    expect(links).toHaveLength(configured);
    expect(within(nav).getByRole("link", { name: /YouTube/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@da_zby",
    );
  });

  it("opens social links safely in a new tab", () => {
    render(<SiteFooter />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
