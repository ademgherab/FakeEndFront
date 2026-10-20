import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/landing/hero";
import {
  Features,
  FinalCta,
  HowItWorks,
  Privacy,
} from "@/components/landing/sections";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "MockAPI — Paste JSON, get a live mock API",
    description:
      "Paste a JSON sample, review the inferred schema, and call a live URL that returns fresh, realistic data.",
  },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <Features />
        <Privacy />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
