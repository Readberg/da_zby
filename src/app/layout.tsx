import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ru } from "@/messages/ru";
import { bodyFont, headingFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: ru.site.name, template: `%s — ${ru.site.name}` },
  description: ru.site.description,
  applicationName: ru.site.name,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: ru.site.name,
    title: ru.site.name,
    description: ru.site.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: ru.site.name,
    description: ru.site.description,
  },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
