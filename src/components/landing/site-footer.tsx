import Link from "next/link";
import { landingContent } from "@/content/landing";

/** Landing-page footer: privacy note, brand and the in-page navigation. */
export function SiteFooter() {
  const { brand, footer } = landingContent;

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-300">{brand.name}</span>
            <span aria-hidden="true"> · </span>
            {footer.note}
          </p>
          <p className="font-mono text-xs text-zinc-400">
            One page. No account. No sign-up.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
          {footer.links.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
