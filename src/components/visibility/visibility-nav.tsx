"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/prompts", label: "Prompts" },
  { href: "/setup", label: "Brand, competitors & budget" },
];

export function VisibilityNav({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b" aria-label="AI visibility sections">
      {TABS.map((t) => {
        const href = base + t.href;
        const active =
          t.href === ""
            ? pathname === base || pathname.startsWith(`${base}/runs`)
            : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              active
                ? "border-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
