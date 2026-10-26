"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

export type TrendPoint = { bucket: string; label: string; [key: string]: string | number };

// Distinct, colorblind-friendly hues per provider (the theme's chart tokens are grayscale).
const COLORS: Record<string, string> = {
  anthropic: "#d55e00",
  openai: "#009e73",
  gemini: "#0072b2",
  perplexity: "#cc79a7",
};
const FALLBACK = ["#e69f00", "#56b4e9", "#000000"];

export function TrendChart({
  data,
  providers,
}: {
  data: TrendPoint[];
  providers: { id: string; label: string }[];
}) {
  const config: ChartConfig = Object.fromEntries(
    providers.map((p, i) => [p.id, { label: p.label, color: COLORS[p.id] ?? FALLBACK[i % FALLBACK.length] }]),
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ChartTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as TrendPoint;
            return (
              <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
                <div className="mb-1 font-medium">Week of {label}</div>
                {providers.map((p) =>
                  point[p.id] === undefined ? null : (
                    <div key={p.id} className="flex items-center gap-2 tabular-nums">
                      <span className="size-2 rounded-full" style={{ background: `var(--color-${p.id})` }} />
                      <span>{p.label}</span>
                      <span className="ml-auto pl-3">
                        {Math.round(Number(point[p.id]) * 100)}% (n = {point[`${p.id}_n`]})
                      </span>
                    </div>
                  ),
                )}
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {providers.map((p) => (
          <Line
            key={p.id}
            dataKey={p.id}
            type="monotone"
            stroke={`var(--color-${p.id})`}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
