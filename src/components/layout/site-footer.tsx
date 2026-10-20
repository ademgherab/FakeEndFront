import Link from "next/link";
import { landingContent } from "@/content/landing";
import { config } from "@/lib/config";

/** FND-07 footer: privacy note, app version and a dev-only health link. */
export function SiteFooter() {
  const { brand, footer } = landingContent;
  const healthUrl = `${config.apiBaseUrl}/health/ready`;

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
            v{config.version}
            {config.isDev ? " · development" : ""}
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
          {footer.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {link.label}
            </Link>
          ))}
          {config.isDev ? (
            <a
              href={healthUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Health
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
