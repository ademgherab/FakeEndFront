import type { Metadata } from "next";
import { DemoConsole } from "@/components/dev/demo-console";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Demo console",
  robots: { index: false, follow: false },
};

const DEMO_SLUG = "demo";
const DEMO_TOKEN = "et_demo_mockapi_hackathon_2026";
const DEMO_ENDPOINT = "https://api.example.com/m/demo/users";

export default function DevDemoPage() {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
        Demo console
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        A clean run, every time
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        The seeded project and its reset button. The full five-minute script
        lives in <code className="font-mono text-xs">docs/demo-script.md</code>.
      </p>

      <div className="mt-8">
        <DemoConsole
          slug={DEMO_SLUG}
          token={DEMO_TOKEN}
          endpointUrl={DEMO_ENDPOINT}
        />
      </div>

      {!config.enableMocks ? (
        <p className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-xs text-amber-100">
          The contract mocks are off in this build, so the seeded project and
          the reset button are not available. Start the app with{" "}
          <code className="font-mono">pnpm dev:mock</code> for a rehearsed
          demo, or create a fresh project against the real API.
        </p>
      ) : null}
    </main>
  );
}
