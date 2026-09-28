import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Server-side analytics for the admin dashboard.
 *
 * Everything is computed from the real `orders` and `events` collections
 * rather than a capped client snapshot, so "revenue, all time" is actually
 * all time. Admin-only.
 *
 * Ranges: 7d | 30d | 90d | all
 */

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

type OrderDoc = {
  total?: number;
  currency?: string;
  status?: string;
  createdAt?: number;
  items?: { productId?: string; name?: string; qty?: number; unitPrice?: number }[];
};

type EventDoc = {
  type?: string;
  ref?: string | null;
  name?: string | null;
  value?: number | null;
  qty?: number | null;
  at?: number;
};

/** Statuses where money has actually been collected. */
const PAID = new Set(["confirmed", "shipped", "delivered"]);

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);

  const rangeKey = req.nextUrl.searchParams.get("range") || "30d";
  const days = rangeKey in RANGE_DAYS ? RANGE_DAYS[rangeKey] : 30;

  const admin = await getAdminApp();
  const db = getFirestore(admin);

  const now = Date.now();
  const todayStart = startOfDay(now);
  // The comparison window immediately before this one, same length.
  const windowMs = days ? days * 86_400_000 : 0;
  const from = days ? todayStart - (days - 1) * 86_400_000 : 0;
  const prevFrom = days ? from - windowMs : 0;

  const [ordersSnap, productsSnap, eventsSnap, settingsSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("products").get(),
    // Events are only needed for a bounded window; "all" would be unbounded,
    // so cap the scan at 90 days regardless.
    db.collection("events").where("at", ">=", Math.max(0, todayStart - 90 * 86_400_000)).get(),
    db.collection("settings").doc("store").get(),
  ]);

  const settings = settingsSnap.data() || {};
  const currency = settings.currency || "ETB";

  const orders = ordersSnap.docs.map((d) => d.data() as OrderDoc);
  const events = eventsSnap.docs.map((d) => d.data() as EventDoc);

  const inWindow = (t?: number) => typeof t === "number" && t >= from && t <= now;
  const inPrev = (t?: number) => typeof t === "number" && t >= prevFrom && t < from;

  const paid = orders.filter((o) => PAID.has(String(o.status)));

  const currentPaid = paid.filter((o) => inWindow(o.createdAt));
  const prevPaid = days ? paid.filter((o) => inPrev(o.createdAt)) : [];

  const revenue = currentPaid.reduce((a, o) => a + (o.total || 0), 0);
  const prevRevenue = prevPaid.reduce((a, o) => a + (o.total || 0), 0);
  const units = currentPaid.reduce(
    (a, o) => a + (o.items || []).reduce((s, it) => s + (it.qty || 0), 0),
    0
  );

  const currentOrders = orders.filter((o) => inWindow(o.createdAt));
  const prevOrders = days ? orders.filter((o) => inPrev(o.createdAt)) : [];

  // Revenue per day across the window (or per month, for "all").
  const series: { at: number; revenue: number; orders: number }[] = [];
  if (days) {
    for (let i = 0; i < days; i++) {
      const dayStart = from + i * 86_400_000;
      const dayEnd = dayStart + 86_400_000;
      const inDay = paid.filter((o) => (o.createdAt || 0) >= dayStart && (o.createdAt || 0) < dayEnd);
      series.push({
        at: dayStart,
        revenue: inDay.reduce((a, o) => a + (o.total || 0), 0),
        orders: inDay.length,
      });
    }
  } else {
    // All-time: bucket by month so the chart stays readable.
    const byMonth = new Map<number, { revenue: number; orders: number }>();
    for (const o of paid) {
      const d = new Date(o.createdAt || 0);
      const key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const cur = byMonth.get(key) || { revenue: 0, orders: 0 };
      cur.revenue += o.total || 0;
      cur.orders += 1;
      byMonth.set(key, cur);
    }
    for (const [at, v] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
      series.push({ at, ...v });
    }
  }

  // Top products by revenue and by units.
  const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of currentPaid) {
    for (const it of o.items || []) {
      const key = it.productId || it.name || "unknown";
      const cur = byProduct.get(key) || { name: it.name || "Unknown", units: 0, revenue: 0 };
      cur.units += it.qty || 0;
      cur.revenue += (it.qty || 0) * (it.unitPrice || 0);
      byProduct.set(key, cur);
    }
  }
  const topProducts = [...byProduct.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Order status breakdown for the window.
  const statusCounts: Record<string, number> = {};
  for (const o of currentOrders) {
    const s = String(o.status || "unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Real funnel from the tracked events, same window.
  const windowEvents = events.filter((e) => inWindow(e.at));
  const countEvent = (t: string) => windowEvents.filter((e) => e.type === t).length;
  const purchases = currentPaid.length;
  const funnel: Record<string, number> = {
    page_view: countEvent("page_view"),
    view_item: countEvent("view_item"),
    add_to_cart: countEvent("add_to_cart"),
    begin_checkout: countEvent("begin_checkout"),
    receipt_submitted: countEvent("receipt_submitted"),
    // "purchase" is derived from verified orders, not a tracked event.
    purchase: purchases,
  };
  const visitors = Math.max(1, funnel.page_view);
  const conversion = (purchases / visitors) * 100;

  // Inventory risk from the live catalogue.
  const products = productsSnap.docs.map((d) => d.data() as { published?: boolean; stock?: Record<string, number> });
  const soldById = new Map<string, number>();
  for (const o of currentPaid) {
    for (const it of o.items || []) {
      if (it.productId) soldById.set(it.productId, (soldById.get(it.productId) || 0) + (it.qty || 0));
    }
  }
  const lowStock = productsSnap.docs
    .map((d) => {
      const data = d.data() as { name?: string; slug?: string; published?: boolean; stock?: Record<string, number> };
      const total = Object.values(data.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      return { id: d.id, name: data.name || "Unnamed", slug: data.slug, published: data.published, total };
    })
    .filter((p) => p.published !== false)
    .filter((p) => p.total <= 4)
    .sort((a, b) => a.total - b.total)
    .slice(0, 10)
    .map((p) => ({ ...p, sold: soldById.get(p.id) || 0 }));

  const pct = (cur: number, prev: number) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

  return json({
    range: rangeKey,
    currency,
    hasComparison: Boolean(days),
    metrics: {
      revenue,
      revenueDelta: pct(revenue, prevRevenue),
      orders: currentOrders.length,
      ordersDelta: pct(currentOrders.length, prevOrders.length),
      paidOrders: currentPaid.length,
      aov: currentPaid.length ? Math.round(revenue / currentPaid.length) : 0,
      aovDelta: pct(
        currentPaid.length ? revenue / currentPaid.length : 0,
        prevPaid.length ? prevRevenue / prevPaid.length : 0
      ),
      units,
      visitors,
      conversion: Math.round(conversion * 10) / 10,
    },
    series,
    topProducts,
    statusCounts,
    funnel,
    lowStock,
    // Lifetime totals, independent of the selected range.
    lifetime: {
      revenue: paid.reduce((a, o) => a + (o.total || 0), 0),
      orders: orders.length,
      customers: new Set(orders.map((o) => (o as unknown as { userId?: string }).userId).filter(Boolean)).size,
    },
    recentOrders: orders
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 8)
      .map((o, i) => {
        const doc = ordersSnap.docs[orders.indexOf(o)];
        return {
          id: doc.id,
          ref: (o as unknown as { ref?: string }).ref,
          email: (o as unknown as { email?: string }).email,
          total: o.total || 0,
          status: o.status,
          createdAt: o.createdAt || 0,
          items: (o.items || []).length,
          index: i,
        };
      }),
  });
}
