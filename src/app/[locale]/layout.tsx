import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env";
import { siteOpenGraph } from "@/lib/open-graph";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { CoverRelease } from "@/components/layout/cover-release";
import { ErrorReporter } from "@/components/layout/error-reporter";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteLoader } from "@/components/layout/site-loader";
import { HydrationMark } from "@/features/home/components/home-fallback";
import { ChatDockGate } from "@/features/chat/components/chat-dock-gate";
import { SiteHeader } from "@/components/layout/site-header";
import { LOCALES, isLocale } from "@/i18n/config";
import { bodyFont, headingFont } from "../fonts";
import "../globals.css";
import { MessagesProvider } from "@/i18n/client";
import { clientDictionary } from "@/i18n/dictionaries";
import { getMessages, initLocale, setRequestLocale } from "@/i18n/server";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = await initLocale(params);
  const t = getMessages();
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t.site.name, template: `%s — ${t.site.name}` },
    description: t.site.description,
    applicationName: t.site.name,
    openGraph: siteOpenGraph(locale, t),
    twitter: {
      card: "summary_large_image",
      title: t.site.name,
      description: t.site.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#090909",
};

/** Both languages are known at build time, so the static shell is prerendered for each (D-088). */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = getMessages();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <MessagesProvider locale={locale} messages={clientDictionary(locale)}>
          <SiteLoader />
          <CoverRelease />
          <HydrationMark />
          <ErrorReporter />
          {/* First stop of the keyboard: jumps over the header to the page. */}
          <a
            href="#content"
            className="sr-only z-[110] rounded-full bg-accent px-5 py-3 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            {t.site.skipToContent}
          </a>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <SiteHeader />
          <main id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
          <SiteFooter />
          <Suspense fallback={null}>
            <ChatDockGate />
          </Suspense>
          {siteConfig.analytics.websiteId && (
            <Script
              defer
              src={siteConfig.analytics.scriptUrl}
              data-website-id={siteConfig.analytics.websiteId}
              data-domains={siteConfig.analytics.domains(publicEnv.NEXT_PUBLIC_SITE_URL)}
              strategy="afterInteractive"
            />
          )}
        </MessagesProvider>
      </body>
    </html>
  );
}
