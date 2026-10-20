import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CreateSuccess } from "@/components/wizard/create-success";

export const metadata: Metadata = {
  title: "Project created",
  description: "Your mock API is live. Save the one-time edit token.",
  robots: { index: false, follow: false },
};

export default function CreateSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16"
      >
        <CreateSuccess />
      </main>
      <SiteFooter />
    </>
  );
}
