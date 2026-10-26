"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "180d", label: "180 days" },
];

export function RangePicker({ current }: { current: string }) {
  const pathname = usePathname();
  return (
    <div className="bg-muted inline-flex rounded-md p-1 text-sm" role="group" aria-label="Date range">
      {OPTIONS.map((o) => (
        <Link
          key={o.key}
          href={`${pathname}?range=${o.key}`}
          aria-current={current === o.key ? "true" : undefined}
          className={cn(
            "rounded px-3 py-1",
            current === o.key ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
