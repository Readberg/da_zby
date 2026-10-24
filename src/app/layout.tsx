import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Да забей",
  description: "Сайт блога «Да забей» о белорусском спорте",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
