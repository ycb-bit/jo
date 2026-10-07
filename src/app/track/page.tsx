"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { ORDER_STATUS_FLOW } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackResult = {
  ref: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  total: number;
  currency: string;
  items: { name: string; color: string; size: string; qty: number; unitPrice: number }[];
  history: { status: OrderStatus; at: number; note?: string }[];
  trackingNote: string;
  receiptSubmitted: boolean;
  rejectionReason: string;
};

export default function TrackOrderPage() {
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (ref.trim().length < 4 || !email.includes("@")) {
      setError("Enter your reference code and the email you ordered with");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not find that order");
      setResult(data as TrackResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that order");
    } finally {
      setBusy(false);
    }
  };

  const step = result ? ORDER_STATUS_FLOW.indexOf(result.status) : -1;
  const terminal = result ? ["rejected", "cancelled"].includes(result.status) : false;

  return (
    <div className="mx-auto max-w-[900px] px-5 pb-28 pt-14 md:px-10">
      <p className="text-[11px] uppercase tracking-[0.22em] opacity-50">Order status</p>
      <h1 className="font-display mt-2 text-5xl uppercase md:text-6xl">Track an order</h1>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
        Your reference is the code we gave you at checkout — it looks like{" "}
        <strong>JO-29P753MB</strong>. Enter it with the email you ordered with and you&apos;ll
        see exactly where your order is.
      </p>

      <form onSubmit={search} className="mt-10 grid gap-5 border border-ink p-6 sm:grid-cols-2 md:p-8">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] opacity-60">Reference</span>
          <input
            className="input mt-2 uppercase"
            placeholder="JO-29P753MB"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] opacity-60">Email</span>
          <input
            className="input mt-2"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:opacity-40 sm:col-span-2"
        >
          {busy ? "Looking…" : "Find my order →"}
        </button>
      </form>

      {error && (
        <p className="mt-6 border border-ember p-4 text-[13px] text-ember">{error}</p>
      )}

      {result && (
        <div className="mt-10">
          <div className="border border-ink p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-display text-3xl tracking-[0.06em]">{result.ref}</p>
              <p
                className={cn(
                  "text-[11px] uppercase tracking-[0.2em]",
                  ["confirmed", "shipped", "delivered"].includes(result.status)
                    ? "text-ember"
                    : ["rejected", "cancelled"].includes(result.status)
                      ? "text-red-700"
                      : "opacity-60"
                )}
              >
                {ORDER_STATUS_LABEL[result.status] || result.status}
              </p>
            </div>
            <p className="mt-2 text-[12px] opacity-55">
              Placed {timeAgo(result.createdAt)} · updated {timeAgo(result.updatedAt)}
            </p>

            {/* Progress */}
            <ol className="mt-8 grid gap-4 sm:grid-cols-6 sm:gap-2">
              {ORDER_STATUS_FLOW.map((s, i) => {
                const done = step >= i;
                return (
                  <li key={s}>
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border text-[11px]",
                        done ? "border-ink bg-ink text-bone" : "border-line opacity-40"
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <p className={cn("mt-2 text-[10px] uppercase tracking-[0.14em]", !done && "opacity-40")}>
                      {ORDER_STATUS_LABEL[s]}
                    </p>
                  </li>
                );
              })}
            </ol>

            {terminal && (
              <p className="mt-6 border-t border-line pt-5 text-[13px] leading-relaxed opacity-75">
                {result.status === "rejected"
                  ? `Jo couldn't verify the payment${result.rejectionReason ? `: ${result.rejectionReason}` : ""}. Send us the receipt again from your account page.`
                  : "This order was cancelled."}
              </p>
            )}

            {result.trackingNote && (
              <p className="mt-6 border-t border-line pt-5 text-[13px]">
                <span className="opacity-60">Tracking — </span>
                {result.trackingNote}
              </p>
            )}

            <ul className="mt-6 divide-y divide-line border-t border-line">
              {result.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between py-3 text-[13px]">
                  <span>
                    {it.name}
                    <span className="opacity-50"> · {it.color}/{it.size} × {it.qty}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(it.unitPrice * it.qty, result.currency)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-4 font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(result.total, result.currency)}</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-5 text-[11px] uppercase tracking-[0.18em]">
            {!result.receiptSubmitted && !terminal && (
              <Link href="/account" className="u-link text-ember">Submit your receipt →</Link>
            )}
            <Link href="/account" className="u-link">All your orders →</Link>
            <Link href="/shop" className="u-link opacity-60">Back to the rack</Link>
          </div>
        </div>
      )}
    </div>
  );
}