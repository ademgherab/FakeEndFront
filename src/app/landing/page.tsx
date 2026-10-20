import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Features, HowItWorks, Privacy } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "FakeEnd — Paste JSON, get a live fake endpoint",
  description:
    "FakeEnd turns a JSON sample into a live fake endpoint: an inferred schema, configurable delay and injected errors, and a URL you can call right away.",
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <Features />
        <Privacy />
      </main>
      <SiteFooter />
    </>
  );
}
