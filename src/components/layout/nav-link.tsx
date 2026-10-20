"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";

export interface NavLinkProps {
  href: string;
  label: string;
  /** Optional custom content; defaults to `label`. */
  children?: ReactNode;
  /** Match only the exact path. */
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  onNavigate?: () => void;
}

/**
 * The only client part of the desktop navigation: it reads the current route to
 * expose `aria-current="page"`. Keeps the rest of the header a server component.
 */
export function NavLink({
  href,
  label,
  children,
  exact = false,
  className,
  activeClassName,
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-label={children ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(className, active && activeClassName)}
    >
      {children ?? label}
    </Link>
  );
}
