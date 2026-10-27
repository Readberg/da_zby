import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ErrorReporter } from "@/components/layout/error-reporter";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteLoader } from "@/components/layout/site-loader";
import { HydrationMark } from "@/features/home/components/home-fallback";
import { SiteHeader } from "@/components/layout/site-header";
import { ru } from "@/messages/ru";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCALES, isLocale } from "@/i18n/config";
import { bodyFont, headingFont } from "../fonts";
import "../globals.css";

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

/** Both languages are known at build time, so the static shell is prerendered for each (D-088). */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <SiteLoader />
        <HydrationMark />
        <ErrorReporter />
        {/* First stop of the keyboard: jumps over the header to the page. */}
        <a
          href="#content"
          className="sr-only z-[110] rounded-full bg-accent px-5 py-3 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {ru.site.skipToContent}
        </a>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SiteHeader />
        <main id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter />
        {siteConfig.analytics.websiteId && (
          <Script
            defer
            src={siteConfig.analytics.scriptUrl}
            data-website-id={siteConfig.analytics.websiteId}
            data-domains={siteConfig.analytics.domains(publicEnv.NEXT_PUBLIC_SITE_URL)}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
