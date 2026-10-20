import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";

import { MockProvider } from "@/components/providers/mock-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const appUrl = config.appUrl;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "MockAPI — Paste JSON, get a live mock API",
    template: "%s · MockAPI",
  },
  description:
    "Paste a JSON sample, review the inferred schema, and call a live URL that returns fresh, realistic data with configurable delay and random errors.",
  applicationName: "MockAPI",
  authors: [{ name: "MockAPI" }],
  openGraph: {
    type: "website",
    siteName: "MockAPI",
    title: "MockAPI — Paste JSON, get a live mock API",
    description:
      "Paste a JSON sample, review the inferred schema, and call a live URL that returns fresh, realistic data with configurable delay and random errors.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "MockAPI — Paste JSON, get a live mock API",
    description:
      "Paste a JSON sample, review the inferred schema, and call a live URL that returns fresh, realistic data.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className="min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased">
        <a
          href="#main-content"
          className="sr-only rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          Skip to content
        </a>
        <TooltipProvider>
          <MockProvider>{children}</MockProvider>
          <Toaster theme="dark" position="bottom-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
