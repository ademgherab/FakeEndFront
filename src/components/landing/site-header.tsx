import Link from "next/link";
import { landingContent } from "@/content/landing";

function ArrowRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * Landing-page header. A server component: the only interactive element is
 * the link to the builder.
 */
export function SiteHeader() {
  const { brand, nav } = landingContent;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link
          href="/landing"
          className="flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label={`${brand.name} home`}
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime-300 font-mono text-xs font-bold text-zinc-950"
          >
            {brand.mark}
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight text-zinc-50">
            {brand.name}
          </span>
        </Link>

        <nav aria-label="Landing sections" className="hidden items-center gap-1 md:flex">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href={nav.cta.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-200"
        >
          <span>{nav.cta.label}</span>
          <ArrowRight />
        </Link>
      </div>
    </header>
  );
}
