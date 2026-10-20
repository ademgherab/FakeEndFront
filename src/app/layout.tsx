import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FakeEnd — Paste JSON, get a live fake endpoint",
  description:
    "FakeEnd turns a JSON sample into a live fake endpoint that returns fresh data with configurable delay and errors.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#0a0a0b] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
