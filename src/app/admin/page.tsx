"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { formatMoney, timeAgo, cn, totalStock } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type Order, type Product } from "@/lib/types";

export default function AdminOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)), (s) =>
      setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[])
    );
    const u2 = onSnapshot(collection(db, "products"), (s) =>
      setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[])
    );
    return () => { u1(); u2(); };
  }, []);

  const stats = useMemo(() => {
    const confirmed = orders.filter((o) => ["confirmed", "shipped", "delivered"].includes(o.status));
    const revenue = confirmed.reduce((a, o) => a + o.total, 0);
    const pending = orders.filter((o) => ["receipt_uploaded", "verifying"].includes(o.status));
    const awaiting = orders.filter((o) => o.status === "awaiting_payment");
    const lowStock = products
      .filter((p) => p.published && totalStock(p.stock || {}) <= 4)
      .sort((a, b) => totalStock(a.stock || {}) - totalStock(b.stock || {}));
    const aov = confirmed.length ? revenue / confirmed.length : 0;

    // last 14 days of verified revenue, per day
    const days: { label: string; total: number }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const from = start.getTime() - i * 86_400_000;
      const to = from + 86_400_000;
      const total = confirmed
        .filter((o) => o.createdAt >= from && o.createdAt < to)
        .reduce((a, o) => a + o.total, 0);
      days.push({ label: new Date(from).toLocaleDateString("en-US", { day: "numeric" }), total });
    }
    const maxDay = Math.max(...days.map((d) => d.total), 1);

    // top sellers by units sold
    const units = new Map<string, { name: string; qty: number }>();
    for (const o of confirmed) {
      for (const it of o.items || []) {
        const cur = units.get(it.productId) || { name: it.name, qty: 0 };
        cur.qty += it.qty;
        units.set(it.productId, cur);
      }
    }
    const topSellers = [...units.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    return { revenue, confirmedCount: confirmed.length, pending, awaiting, lowStock, aov, days, maxDay, topSellers };
  }, [orders, products]);

  return (
    <div>
      <h1 className="font-display text-4xl uppercase">Studio overview</h1>
      <p className="mt-1 text-[13px] opacity-60">Everything happening in Jo&apos;s shop, right now.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Revenue (verified)", formatMoney(stats.revenue), `${stats.confirmedCount} paid orders`],
          ["Needs verification", String(stats.pending.length), "Receipts waiting on you"],
          ["Awaiting payment", String(stats.awaiting.length), "Opened checkout, no receipt yet"],
          ["Live products", String(products.filter((p) => p.published).length), `${products.length} total in catalog`],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-bone/15 p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">{label}</p>
            <p className="font-display mt-3 text-4xl tabular-nums">{value}</p>
            <p className="mt-2 text-[11px] opacity-50">{sub}</p>
          </div>
        ))}
      </div>

      {/* 14-day revenue chart */}
      <div className="mt-8 border border-bone/15 p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Revenue — last 14 days</p>
          <p className="text-[11px] opacity-50">Avg order {formatMoney(stats.aov)}</p>
        </div>
        <div className="mt-5 flex h-28 items-end gap-1.5">
          {stats.days.map((d) => (
            <div key={d.label} className="group relative flex-1">
              <div
                className={cn("w-full transition-all", d.total > 0 ? "bg-ember" : "bg-bone/15")}
                style={{ height: `${Math.max(4, (d.total / stats.maxDay) * 100)}%` }}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap bg-bone px-1.5 py-0.5 text-[10px] text-ink group-hover:block">
                {d.label}: {formatMoney(d.total)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* funnel + top sellers */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="border border-bone/15 p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Checkout funnel — live</p>
          <div className="mt-4 space-y-2.5 text-[12px]">
            {[
              ["Opened checkout", stats.awaiting.length + stats.pending.length + stats.confirmedCount, "bg-bone/25"],
              ["Receipt uploaded", stats.pending.length, "bg-ember/60"],
              ["Paid (verified)", stats.confirmedCount, "bg-ember"],
            ].map(([label, n, color]) => (
              <div key={String(label)}>
                <div className="flex justify-between opacity-70"><span>{label}</span><span className="tabular-nums">{n}</span></div>
                <div className="mt-1 h-2 w-full bg-bone/10">
                  <div
                    className={cn("h-full transition-all duration-700", color as string)}
                    style={{ width: `${Math.min(100, (Number(n) / Math.max(1, stats.awaiting.length + stats.pending.length + stats.confirmedCount)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-bone/15 p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Top sellers — all time</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            {stats.topSellers.map((t, i) => (
              <li key={t.name} className="flex items-baseline gap-3">
                <span className="font-display text-ember w-6">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="tabular-nums opacity-60">{t.qty} sold</span>
              </li>
            ))}
            {stats.topSellers.length === 0 && <li className="opacity-50">No verified sales yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl uppercase">Latest orders</h2>
            <Link href="/admin/orders" className="text-[11px] uppercase tracking-[0.16em] text-ember hover:underline">Open desk →</Link>
          </div>
          <ul className="mt-4 divide-y divide-bone/10 border-y border-bone/10">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link href="/admin/orders" className="flex items-center justify-between gap-4 py-3.5 text-[13px] transition-colors hover:bg-bone/5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.ref || o.id.slice(0, 10)} <span className="opacity-50">· {o.email}</span></p>
                    <p className="text-[11px] opacity-50">{timeAgo(o.createdAt)} · {o.items.length} items</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums">{formatMoney(o.total, o.currency)}</p>
                    <p className={cn("text-[10px] uppercase tracking-[0.14em]", o.status === "verifying" || o.status === "receipt_uploaded" ? "text-ember" : "opacity-50")}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {orders.length === 0 && <li className="py-10 text-center text-[13px] opacity-50">No orders yet — they&apos;ll land here live.</li>}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl uppercase">Low stock alert</h2>
            <Link href="/admin/products" className="text-[11px] uppercase tracking-[0.16em] text-ember hover:underline">Manage →</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {stats.lowStock.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between border border-bone/15 px-4 py-3 text-[13px]">
                <span className="truncate">{p.name}</span>
                <span className={cn("shrink-0 tabular-nums", totalStock(p.stock || {}) === 0 ? "text-red-400" : "text-ember")}>
                  {totalStock(p.stock || {})} left
                </span>
              </li>
            ))}
            {stats.lowStock.length === 0 && <li className="border border-bone/15 px-4 py-8 text-center text-[13px] opacity-50">Stock levels look healthy.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
