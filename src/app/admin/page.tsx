"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { formatMoney, timeAgo, cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/types";

/**
 * Studio overview — every number comes from /api/admin/analytics, which
 * aggregates the full orders + events collections server-side (the old view
 * capped at 100 orders, so "all time" was quietly wrong).
 */

type Range = "7d" | "30d" | "90d" | "all";

type Analytics = {
  range: Range;
  currency: string;
  hasComparison: boolean;
  metrics: {
    revenue: number;
    revenueDelta: number | null;
    orders: number;
    ordersDelta: number | null;
    paidOrders: number;
    aov: number;
    aovDelta: number | null;
    units: number;
    visitors: number;
    conversion: number;
  };
  series: { at: number; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; units: number; revenue: number }[];
  statusCounts: Record<string, number>;
  funnel: Record<string, number>;
  lowStock: { id: string; name: string; slug?: string; total: number; sold: number }[];
  lifetime: { revenue: number; orders: number; customers: number };
  recentOrders: {
    id: string;
    ref?: string;
    email?: string;
    total: number;
    status: string;
    createdAt: number;
    items: number;
  }[];
};

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

const FUNNEL_STEPS: { key: string; label: string; color: string }[] = [
  { key: "page_view", label: "Page views", color: "bg-bone/25" },
  { key: "view_item", label: "Product views", color: "bg-bone/40" },
  { key: "add_to_cart", label: "Added to bag", color: "bg-ember/50" },
  { key: "begin_checkout", label: "Started checkout", color: "bg-ember/75" },
  { key: "purchase", label: "Paid (verified)", color: "bg-ember" },
];

export default function AdminOverview() {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/analytics?range=${r}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load analytics");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const cur = data?.currency || "ETB";
  const m = data?.metrics;
  const maxSeries = Math.max(...(data?.series || []).map((s) => s.revenue), 1);
  const maxFunnel = Math.max(...FUNNEL_STEPS.map((s) => data?.funnel[s.key] || 0), 1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase">Studio overview</h1>
          <p className="mt-1 text-[13px] opacity-60">
            Live from your orders and storefront events.
          </p>
        </div>
        <div className="flex border border-bone/15">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors",
                range === r.key ? "bg-bone text-ink" : "opacity-55 hover:opacity-100"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 border border-red-400/40 bg-red-400/5 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 border border-bone/15 p-6">
              <div className="skeleton h-3 w-24 bg-bone/10" />
              <div className="skeleton mt-4 h-8 w-32 bg-bone/10" />
            </div>
          ))}
        </div>
      )}

      {m && (
        <>
          {/* Headline metrics with period-over-period deltas */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Verified revenue"
              value={formatMoney(m.revenue, cur)}
              delta={m.revenueDelta}
              sub={`${m.paidOrders} paid order${m.paidOrders === 1 ? "" : "s"}`}
              loading={loading}
            />
            <Metric
              label="Orders"
              value={String(m.orders)}
              delta={m.ordersDelta}
              sub={`${m.units} item${m.units === 1 ? "" : "s"} sold`}
              loading={loading}
            />
            <Metric
              label="Average order"
              value={formatMoney(m.aov, cur)}
              delta={m.aovDelta}
              sub="Verified orders only"
              loading={loading}
            />
            <Metric
              label="Conversion"
              value={`${m.conversion}%`}
              sub={`${m.visitors} page view${m.visitors === 1 ? "" : "s"}`}
              loading={loading}
            />
          </div>

          {/* Revenue over time */}
          <div className="mt-8 border border-bone/15 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">
                Verified revenue — {RANGES.find((r) => r.key === range)?.label.toLowerCase()}
              </p>
              <p className="text-[11px] opacity-50">
                Lifetime {formatMoney(data!.lifetime.revenue, cur)} · {data!.lifetime.customers} customer
                {data!.lifetime.customers === 1 ? "" : "s"}
              </p>
            </div>

            {data!.series.length === 0 ? (
              <p className="py-16 text-center text-[13px] opacity-50">No verified revenue in this period.</p>
            ) : (
              <>
                <div className="mt-6 flex h-36 items-end gap-1">
                  {data!.series.map((s) => (
                    <div key={s.at} className="group relative flex h-full flex-1 items-end">
                      <div
                        className={cn(
                          "w-full transition-all duration-500",
                          s.revenue > 0 ? "bg-ember" : "bg-bone/15"
                        )}
                        style={{ height: `${s.revenue > 0 ? Math.max(3, (s.revenue / maxSeries) * 100) : 2}%` }}
                      />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-bone px-2 py-1 text-[10px] text-ink group-hover:block">
                        {range === "all"
                          ? new Date(s.at).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                          : new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        : {formatMoney(s.revenue, cur)} · {s.orders} order{s.orders === 1 ? "" : "s"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.14em] opacity-40">
                  <span>
                    {range === "all"
                      ? new Date(data!.series[0].at).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                      : new Date(data!.series[0].at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span>
                    {new Date(data!.series[data!.series.length - 1].at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Funnel + top products */}
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="border border-bone/15 p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">
                Storefront funnel — real events
              </p>
              <div className="mt-5 space-y-3">
                {FUNNEL_STEPS.map((s) => {
                  const n = data!.funnel[s.key] || 0;
                  const rate = data!.funnel.page_view ? (n / data!.funnel.page_view) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-baseline justify-between text-[12px]">
                        <span className="opacity-70">{s.label}</span>
                        <span className="tabular-nums">
                          {n.toLocaleString()}
                          <span className="ml-2 text-[10px] opacity-45">{rate.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-bone/10">
                        <div
                          className={cn("h-full transition-all duration-700", s.color)}
                          style={{ width: `${(n / maxFunnel) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {(data!.funnel.page_view || 0) === 0 && (
                <p className="mt-4 text-[11px] leading-relaxed opacity-45">
                  Funnel numbers appear once real shoppers visit. Events are recorded from
                  this device and any customer device.
                </p>
              )}
            </div>

            <div className="border border-bone/15 p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Top products</p>
              {data!.topProducts.length === 0 ? (
                <p className="py-10 text-center text-[13px] opacity-50">No sales in this period yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-bone/10">
                  {data!.topProducts.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                      <span className="font-display w-5 shrink-0 text-ember">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-[11px] opacity-50">{p.units} sold</span>
                      <span className="w-24 shrink-0 text-right tabular-nums">{formatMoney(p.revenue, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
            <section>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl uppercase">Latest orders</h2>
                <Link href="/admin/orders" className="text-[11px] uppercase tracking-[0.16em] text-ember hover:underline">
                  Open desk →
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-bone/10 border-y border-bone/10">
                {data!.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href="/admin/orders" className="flex items-center justify-between gap-4 py-3.5 text-[13px] transition-colors hover:bg-bone/5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {o.ref || o.id.slice(0, 10)}{" "}
                          <span className="opacity-50">· {o.email}</span>
                        </p>
                        <p className="text-[11px] opacity-50">
                          {timeAgo(o.createdAt)} · {o.items} item{o.items === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums">{formatMoney(o.total, cur)}</p>
                        <p
                          className={cn(
                            "text-[10px] uppercase tracking-[0.14em]",
                            o.status === "verifying" || o.status === "receipt_uploaded"
                              ? "text-ember"
                              : "opacity-50"
                          )}
                        >
                          {ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] || o.status}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
                {data!.recentOrders.length === 0 && (
                  <li className="py-10 text-center text-[13px] opacity-50">No orders yet.</li>
                )}
              </ul>
            </section>

            <section className="space-y-8">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl uppercase">Needs attention</h2>
                  <Link href="/admin/orders" className="text-[11px] uppercase tracking-[0.16em] text-ember hover:underline">
                    Verify →
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(["awaiting_payment", "verifying", "receipt_uploaded", "rejected"] as const).map((s) => {
                    const n = data!.statusCounts[s] || 0;
                    return (
                      <div
                        key={s}
                        className={cn(
                          "border px-4 py-3",
                          n > 0 && (s === "rejected" ? "border-red-400/40" : "border-ember/40")
                        )}
                      >
                        <p className="font-display text-2xl tabular-nums">{n}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] opacity-55">
                          {ORDER_STATUS_LABEL[s]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl uppercase">Low stock</h2>
                  <Link href="/admin/products" className="text-[11px] uppercase tracking-[0.16em] text-ember hover:underline">
                    Manage →
                  </Link>
                </div>
                <ul className="mt-4 space-y-2">
                  {data!.lowStock.slice(0, 6).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between border border-bone/15 px-4 py-2.5 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span
                        className={cn(
                          "ml-3 shrink-0 tabular-nums text-[12px]",
                          p.total === 0 ? "text-red-400" : "text-ember"
                        )}
                      >
                        {p.total} left
                      </span>
                    </li>
                  ))}
                  {data!.lowStock.length === 0 && (
                    <li className="border border-bone/15 px-4 py-8 text-center text-[13px] opacity-50">
                      Stock levels look healthy.
                    </li>
                  )}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  delta,
  sub,
  loading,
}: {
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className={cn("border border-bone/15 p-6 transition-opacity", loading && "opacity-60")}>
      <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-display text-4xl tabular-nums">{value}</p>
        {delta != null && (
          <span
            className={cn(
              "text-[11px] tabular-nums",
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "opacity-45"
            )}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <p className="mt-2 text-[11px] opacity-50">{sub}</p>}
    </div>
  );
}
