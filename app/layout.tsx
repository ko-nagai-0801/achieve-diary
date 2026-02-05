/* app/layout.tsx */
import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "できたこと日記",
  description: "自己肯定感を育てる、できたことリスト日記",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
