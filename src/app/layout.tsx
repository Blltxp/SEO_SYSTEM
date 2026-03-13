import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "../components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEO System",
  description: "ระบบตรวจสอบ SEO, Keyword Ranking และ Cannibalization",
  icons: {
    icon: "/information.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#0a0a0a] font-sans antialiased text-zinc-100`}
        suppressHydrationWarning
      >
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-h-screen flex-1 pl-60 overflow-x-hidden px-6 pt-6 pb-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
