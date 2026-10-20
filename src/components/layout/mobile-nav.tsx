"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";

export interface MobileNavLink {
  href: string;
  label: string;
  exact?: boolean;
}

export interface MobileNavProps {
  links: MobileNavLink[];
}

/**
 * Disclosure-style mobile navigation. It is not a modal, so focus stays in the
 * normal document order and can never be trapped. The primary CTA lives outside
 * this component and is always visible.
 */
export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <XIcon aria-hidden="true" />
        ) : (
          <MenuIcon aria-hidden="true" />
        )}
      </Button>

      {open ? (
        <nav
          id={panelId}
          aria-label="Mobile"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md"
        >
          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  exact={link.exact}
                  onNavigate={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50"
                  activeClassName="bg-white/[0.06] text-zinc-50"
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
