import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { publicEnv } from "@/lib/env";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ru } from "@/messages/ru";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
