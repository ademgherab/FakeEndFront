import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } &
    AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import HomePage from "@/app/page";

describe("landing page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("routes every primary CTA to the builder", () => {
    render(<HomePage />);

    const ctas = screen.getAllByRole("link", { name: /create a mock api/i });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/new");
    }
  });

  it("routes every secondary CTA to the quickstart", () => {
    render(<HomePage />);

    const ctas = screen.getAllByRole("link", { name: /read the quickstart/i });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/help");
    }
  });

  it("exposes a single main heading and the privacy warning", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        name: /do not paste real or sensitive data/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders without requesting the meta endpoint", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<HomePage />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
