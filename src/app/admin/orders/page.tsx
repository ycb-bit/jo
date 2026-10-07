"use client";

import { useEffect, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { getDownloadURL, ref as sRef } from "firebase/storage";
import { formatMoney, timeAgo, cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";
import { addressLines } from "@/lib/addresses";

const FILTERS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "verify", label: "Verification queue", statuses: ["receipt_uploaded", "verifying"] },
  { key: "awaiting", label: "Awaiting payment", statuses: ["awaiting_payment"] },
  { key: "active", label: "Active", statuses: ["confirmed", "shipped"] },
  { key: "done", label: "Delivered", statuses: ["delivered"] },
  { key: "problem", label: "Rejected / cancelled", statuses: ["rejected", "cancelled"] },
  { key: "all", label: "Everything", statuses: [] },
];

export default function AdminOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("verify");
  const [selected, setSelected] = useState<Order | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200)),
      (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]),
      () => {}
    );
  }, []);

  const select = (o: Order) => {
    setSelected(o);
    setNote("");
    setReceiptPreview(null);
    if (o.receiptData) {
      // New pipeline: inline data URI — no fetch needed.
      setReceiptPreview(o.receiptData);
    } else if (o.receiptUrl) {
      // Legacy orders: resolve from Storage.
      getDownloadURL(sRef(storage, o.receiptUrl))
        .then(setReceiptPreview)
        .catch(() => setReceiptPreview(null));
    }
  };

  /** Everything Jo needs to hand the parcel to a courier, as plain text. */
  const copyContact = async () => {
    if (!selected) return;
    const a = selected.shippingAddress;
    const block = [
      selected.ref || selected.id.slice(0, 10),
      a?.fullName,
      a?.phone,
      selected.email,
      ...(a ? addressLines(a) : []),
      a?.country || "Ethiopia",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const act = async (action: "verify" | "reject" | "ship" | "deliver" | "cancel") => {
    if (!selected) return;
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: selected.id, action, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Action failed");
      toast(
        action === "verify" ? "Payment verified — stock updated" :
        action === "reject" ? "Receipt rejected" :
        action === "ship" ? "Marked shipped" : "Updated"
      );
      setSelected(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const f = FILTERS.find((x) => x.key === filter)!;
  const visible = f.statuses.length ? orders.filter((o) => f.statuses.includes(o.status)) : orders;

  return (
    <div>
      <h1 className="font-display text-4xl uppercase">Verification desk</h1>
      <p className="mt-1 text-[13px] opacity-60">Check the bank receipt against the amount, then verify. Stock adjusts automatically.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((x) => {
          const count = x.statuses.length ? orders.filter((o) => x.statuses.includes(o.status)).length : orders.length;
          return (
            <button
              key={x.key}
              onClick={() => setFilter(x.key)}
              className={cn(
                "border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors",
                filter === x.key ? "border-bone bg-bone text-ink" : "border-bone/20 opacity-60 hover:opacity-100"
              )}
            >
              {x.label} {count > 0 && <sup>{count}</sup>}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        <ul className="divide-y divide-bone/10 border-y border-bone/10">
          {visible.map((o) => (
            <li key={o.id}>
              <button onClick={() => select(o)} className={cn(
                "flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left text-[13px] transition-colors hover:bg-bone/5",
                selected?.id === o.id && "bg-bone/10"
              )}>
                <div className="min-w-0">
                  <p className="font-medium">{o.ref || o.id.slice(0, 10)} <span className="opacity-50">· {o.email}</span></p>
                  <p className="text-[11px] tabular-nums opacity-50">{o.shippingAddress?.phone || "No phone on file"}</p>
                  <p className="text-[11px] opacity-50">
                    {timeAgo(o.createdAt)} · {o.items.map((i) => `${i.name} ×${i.qty}`).join(", ").slice(0, 70)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums">{formatMoney(o.total, o.currency)}</p>
                  <p className={cn("text-[10px] uppercase tracking-[0.14em]", ["receipt_uploaded", "verifying"].includes(o.status) ? "text-ember" : "opacity-50")}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="py-14 text-center text-[13px] opacity-50">Nothing in this queue.</li>
          )}
        </ul>

        {/* Detail panel */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          {!selected ? (
            <div className="border border-bone/15 p-10 text-center text-[13px] opacity-50">
              Pick an order to review its receipt.
            </div>
          ) : (
            <div className="border border-bone/15">
              <div className="flex items-center justify-between border-b border-bone/15 p-5">
                <div>
                  <p className="font-display text-xl uppercase">{selected.ref || selected.id.slice(0, 10)}</p>
                  <p className="text-[11px] opacity-50">
                    {selected.email} · {selected.shippingAddress?.phone || "no phone"} · {timeAgo(selected.createdAt)}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-[11px] uppercase tracking-[0.14em] opacity-50 hover:opacity-100">Close</button>
              </div>

              <div className="space-y-4 p-5 text-[13px]">
                <div className="flex justify-between border border-bone/15 p-4">
                  <span className="opacity-60">Expected amount</span>
                  <span className="font-display text-2xl tabular-nums">{formatMoney(selected.total, selected.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Bank reference given</span>
                  <span className="tabular-nums">{selected.receiptRef || "—"}</span>
                </div>
                {selected.paymentMethodName && (
                  <div className="flex justify-between">
                    <span className="opacity-60">Paid via</span>
                    <span>{selected.paymentMethodName}</span>
                  </div>
                )}
                {selected.receiptMissing && (
                  <p className="border border-ember p-4 text-[12px] leading-relaxed text-ember">
                    Submitted with a reference but no receipt image — check the bank statement
                    before you verify.
                  </p>
                )}
                {selected.rejectionReason && (
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 opacity-60">Rejected because</span>
                    <span className="text-right">{selected.rejectionReason}</span>
                  </div>
                )}
                {selected.trackingNote && (
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 opacity-60">Tracking</span>
                    <span className="text-right">{selected.trackingNote}</span>
                  </div>
                )}

                {/* Who to ring, and where the parcel goes — the two things the
                    desk reads first. Phone and email are one tap to call / mail. */}
                <div className="border border-bone/15">
                  <div className="flex items-center justify-between border-b border-bone/15 px-4 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.18em] opacity-60">Customer</p>
                    <button onClick={copyContact} className="text-[10px] uppercase tracking-[0.16em] text-ember transition-opacity hover:opacity-70">
                      {copied ? "Copied ✓" : "Copy all"}
                    </button>
                  </div>
                  <dl className="space-y-2.5 p-4">
                    <div className="flex justify-between gap-4">
                      <dt className="shrink-0 opacity-50">Name</dt>
                      <dd className="text-right font-medium">{selected.shippingAddress?.fullName || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="shrink-0 opacity-50">Phone</dt>
                      <dd className="text-right">
                        {selected.shippingAddress?.phone ? (
                          <a
                            href={`tel:${selected.shippingAddress.phone.replace(/[^\d+]/g, "")}`}
                            className="u-link tabular-nums"
                          >
                            {selected.shippingAddress.phone}
                          </a>
                        ) : (
                          <span className="opacity-40">Not given</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="shrink-0 opacity-50">Email</dt>
                      <dd className="min-w-0 text-right">
                        <a href={`mailto:${selected.email}`} className="u-link break-all">{selected.email}</a>
                      </dd>
                    </div>
                  </dl>
                </div>

                {selected.shippingAddress ? (
                  <div className="border border-bone/15 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] opacity-60">Ship to</p>
                    <address className="mt-2 space-y-0.5 not-italic leading-relaxed opacity-85">
                      {addressLines(selected.shippingAddress).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      {selected.shippingAddress.postalCode && <p>{selected.shippingAddress.postalCode}</p>}
                      <p>{selected.shippingAddress.country || "Ethiopia"}</p>
                      <p className="tabular-nums">{selected.shippingAddress.phone}</p>
                    </address>
                  </div>
                ) : (
                  <p className="border border-dashed border-bone/20 p-4 text-[12px] opacity-50">
                    This order has no shipping address on file — check with the customer before packing.
                  </p>
                )}
                <div>
                  <p className="mb-2 opacity-60">Receipt</p>
                  {receiptPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receiptPreview} alt="Bank receipt" className="max-h-[420px] w-full border border-bone/15 object-contain bg-bone" />
                  ) : (
                    <p className="border border-dashed border-bone/20 p-6 text-center opacity-50">
                      {selected.receiptUrl ? "Receipt file exists but couldn't be loaded." : "No receipt uploaded yet."}
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 opacity-60">Items</p>
                  <ul className="space-y-1.5">
                    {selected.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between opacity-80">
                        <span>{i.name} <span className="opacity-50">{i.color}/{i.size} ×{i.qty}</span></span>
                        <span className="tabular-nums">{formatMoney(i.unitPrice * i.qty, selected.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What happened to this order, newest first — the audit trail the
                    desk needs when a customer asks why it was rejected. */}
                <div>
                  <p className="mb-2 opacity-60">Timeline</p>
                  <ol className="space-y-1.5">
                    {[...(selected.history || [])].reverse().map((h, i) => (
                      <li key={i} className="flex gap-3 text-[12px] leading-relaxed">
                        <span className="w-32 shrink-0 tabular-nums opacity-40">
                          {new Date(h.at).toLocaleString()}
                        </span>
                        <span>
                          {ORDER_STATUS_LABEL[h.status] || h.status}
                          {h.note && <span className="opacity-60"> — {h.note}</span>}
                        </span>
                      </li>
                    ))}
                    {(selected.history || []).length === 0 && (
                      <li className="text-[12px] opacity-40">No events recorded.</li>
                    )}
                  </ol>
                </div>

                <div className="border-t border-bone/15 pt-3 text-[11px] leading-relaxed opacity-40">
                  <p>Order id {selected.id}</p>
                  <p>Customer uid {selected.userId}</p>
                  <p>
                    Placed {new Date(selected.createdAt).toLocaleString()} · updated{" "}
                    {timeAgo(selected.updatedAt)}
                  </p>
                </div>

                <input
                  className="w-full border-b border-bone/25 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-bone/30 focus:border-bone"
                  placeholder="Note (reason for rejection, tracking number…)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  {["receipt_uploaded", "verifying"].includes(selected.status) && (
                    <>
                      <button onClick={() => act("verify")} disabled={busy} className="col-span-2 bg-ember py-3.5 text-[11px] uppercase tracking-[0.2em] text-bone transition-opacity hover:opacity-90 disabled:opacity-50">
                        ✓ Verify payment &amp; reserve stock
                      </button>
                      <button onClick={() => act("reject")} disabled={busy} className="col-span-2 border border-bone/30 py-3 text-[11px] uppercase tracking-[0.2em] opacity-80 hover:border-bone disabled:opacity-50">
                        Reject receipt
                      </button>
                    </>
                  )}
                  {selected.status === "confirmed" && (
                    <button onClick={() => act("ship")} disabled={busy} className="col-span-2 border border-bone bg-bone py-3.5 text-[11px] uppercase tracking-[0.2em] text-ink hover:opacity-90 disabled:opacity-50">
                      Mark shipped
                    </button>
                  )}
                  {selected.status === "shipped" && (
                    <button onClick={() => act("deliver")} disabled={busy} className="col-span-2 border border-bone bg-bone py-3.5 text-[11px] uppercase tracking-[0.2em] text-ink hover:opacity-90 disabled:opacity-50">
                      Mark delivered
                    </button>
                  )}
                  {selected.status === "rejected" && (
                    <button onClick={() => act("cancel")} disabled={busy} className="col-span-2 border border-bone/30 py-3 text-[11px] uppercase tracking-[0.2em] opacity-70 hover:border-bone disabled:opacity-50">
                      Cancel order
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
