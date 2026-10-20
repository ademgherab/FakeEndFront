import Link from "next/link";
import { landingContent } from "@/content/landing";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";

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

const workspaceLinks = [
  { href: "/projects", label: "Recent projects" },
  { href: "/help", label: "Help" },
];

/**
 * FND-07 shell header. Server component; only the active-route link and the
 * mobile disclosure are client leaves. The token and slug never appear here.
 */
export function SiteHeader() {
  const { brand } = landingContent;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link
          href="/"
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {workspaceLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                className="rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                activeClassName="bg-white/[0.06] text-zinc-100"
              />
            ))}
          </nav>

          <NavLink
            href="/new"
            label="New project"
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-200"
            activeClassName="ring-2 ring-lime-200/60 ring-offset-2 ring-offset-zinc-950"
          >
            <span>New project</span>
            <ArrowRight />
          </NavLink>

          <MobileNav links={workspaceLinks} />
        </div>
      </div>
    </header>
  );
}
