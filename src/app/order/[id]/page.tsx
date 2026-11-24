"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { auth, db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/store";
import { doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref as sRef } from "firebase/storage";
import { compressImageToDataUri } from "@/lib/image-compress";
import { formatMoney, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_FLOW, type Order, type OrderStatus } from "@/lib/types";
import { OrderRef } from "@/components/order-ref";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { fbUser } = useAuth();
  const { toast } = useToast();
  const { t } = useT();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, "orders", id), (snap) => {
      setOrder(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null);
    }, () => setOrder(null));
  }, [id]);

  if (order === undefined) {
    return <div className="mx-auto max-w-[1440px] px-5 py-24"><div className="skeleton h-80 w-full" /></div>;
  }
  if (order === null) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-32 text-center md:px-10">
        <h1 className="font-display text-5xl uppercase">{t("order.notFound")}</h1>
        <Link href="/account" className="u-link mt-6 inline-block text-[12px] uppercase tracking-[0.2em]">{t("order.yourOrders")}</Link>
      </div>
    );
  }

  const flowIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const terminal = ["rejected", "cancelled"].includes(order.status);
  // `receipt_uploaded` belongs here: the image may be attached but not yet
  // submitted (or the submit may have failed), and there must still be a way
  // to finish from this page.
  const canPay = ["awaiting_payment", "receipt_uploaded", "rejected"].includes(order.status);

  const upload = async () => {
    if (!file || !fbUser) return;
    setBusy(true);
    try {
      // Compress in the browser → data URI straight into the order doc. No bucket.
      const dataUri = await compressImageToDataUri(file, 1400, 0.72);
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/orders/receipt/upload", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, dataUri, name: file.name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t("toast.uploadFailed"));
      toast(t("toast.receiptUploaded"));
      setFile(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toast.uploadFailed"), "err");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!fbUser) return;
    // Image-first: the photo is what Jo verifies; the reference is optional.
    if (!order.receiptData && !order.receiptUrl) {
      toast(t("toast.addReceiptFirst"), "err");
      return;
    }
    setBusy(true);
    try {
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/orders/receipt/submit", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, receiptRef: receiptRef.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t("toast.submitFailed"));
      toast(t("toast.receiptSubmitted"));
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toast.submitFailed"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      <p className="text-[11px] uppercase tracking-[0.22em] opacity-50">{t("order.kicker")}</p>
      <h1 className="font-display mt-2 text-5xl uppercase md:text-6xl">{order.ref || order.id.slice(0, 8)}</h1>
      <p className="mt-2 text-[13px] opacity-60">
        {t("order.placed", { placed: timeAgo(order.createdAt), amount: formatMoney(order.total, order.currency) })}
      </p>

      <OrderRef
        value={order.ref || order.id.slice(0, 8)}
        label={t("order.referenceCode")}
        hint={t("order.referenceHint")}
        className="mt-6 max-w-xl"
      />

      {/* Status timeline */}
      <div className="mt-12 border border-ink p-6 md:p-10">
        {terminal ? (
          <div>
            <p className="font-display text-3xl uppercase text-ember">{t(`status.${order.status}`)}</p>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
              {order.status === "rejected"
                ? order.rejectionReason
                  ? t("order.rejectedWhy", { reason: order.rejectionReason })
                  : t("order.rejected")
                : t("order.cancelled")}
            </p>
          </div>
        ) : (
          <ol className="grid gap-5 md:grid-cols-6 md:gap-2">
            {ORDER_STATUS_FLOW.map((s, i) => {
              const done = flowIdx >= i;
              const current = flowIdx === i;
              return (
                <li key={s} className="relative">
                  <motion.div
                    initial={false}
                    animate={{ scale: current ? [1, 1.12, 1] : 1 }}
                    transition={current ? { repeat: Infinity, duration: 2 } : {}}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center border text-[11px]",
                      done ? "border-ink bg-ink text-bone" : "border-line opacity-40",
                      current && "border-ember bg-ember text-bone"
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </motion.div>
                  <p className={cn("mt-3 text-[10px] uppercase tracking-[0.14em] md:mt-4", !done && "opacity-40")}>
                    {t(`status.${s}`)}
                  </p>
                  {i < ORDER_STATUS_FLOW.length - 1 && (
                    <span className={cn("absolute left-10 top-4 hidden h-px w-[calc(100%-2.5rem)] md:block", flowIdx > i ? "bg-ink" : "bg-line")} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        {/* Items */}
        <div>
          <h2 className="font-display text-xl uppercase">{t("order.pieces")}</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-4 text-[14px]">
                <div>
                  <Link href={`/product/${it.slug}`} className="u-link font-medium">{it.name}</Link>
                  <p className="text-[12px] opacity-50">{it.color} / {it.size} × {it.qty}</p>
                </div>
                <p className="tabular-nums">{formatMoney(it.unitPrice * it.qty, order.currency)}</p>
              </li>
            ))}
          </ul>

          {/* Payment actions when not yet verified */}
          {canPay && (
            <div className="mt-8 border border-dashed border-ink/30 p-6">
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("order.stillNeedPayment")}</p>
              <p className="mt-2 text-[13px] leading-relaxed opacity-70">
                {t("order.sendAmount", { amount: formatMoney(order.total, order.currency), ref: order.ref || "" })}
              </p>
              <label className="mt-4 flex cursor-pointer items-center justify-between border border-line px-4 py-3 text-[13px] transition-colors hover:border-ink">
                <span>{file ? `${file.name} ✓` : order.receiptData || order.receiptUrl ? t("order.replaceReceipt") : t("order.chooseReceipt")}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <span className="opacity-50">{t("order.browse")}</span>
              </label>
              <div className="mt-3 flex gap-3">
                <button onClick={upload} disabled={!file || busy} className="flex-1 border border-ink bg-ink py-3 text-[11px] uppercase tracking-[0.2em] text-bone disabled:opacity-40">
                  {t("order.uploadReceipt")}
                </button>
              </div>
              <input
                className="input mt-4"
                placeholder={t("order.bankRefOptional")}
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
              />
              <button
                onClick={submit}
                disabled={busy || (!order.receiptData && !order.receiptUrl)}
                className="mt-3 w-full border border-line py-3 text-[11px] uppercase tracking-[0.2em] hover:border-ink disabled:opacity-40"
              >
                {(order.receiptData || order.receiptUrl) ? t("order.submitVerify") : t("order.uploadThenSubmit")}
              </button>
              <p className="mt-3 text-[12px] leading-relaxed opacity-55">
                {t("order.receiptHint")}
              </p>
            </div>
          )}
        </div>

        {/* Meta */}
        <aside className="space-y-6">
          <div className="border border-line p-6 text-[13px]">
            <h3 className="font-display text-sm uppercase tracking-[0.16em]">{t("order.shippingTo")}</h3>
            <address className="mt-3 not-italic leading-relaxed opacity-70">
              {order.shippingAddress?.fullName}<br />
              {order.shippingAddress?.line1}<br />
              {order.shippingAddress?.line2 && <>{order.shippingAddress.line2}<br /></>}
              {order.shippingAddress?.city} {order.shippingAddress?.postalCode}<br />
              {order.shippingAddress?.country}
            </address>
          </div>
          {order.trackingNote && (
            <div className="border border-ember p-6 text-[13px]">
              <h3 className="font-display text-sm uppercase tracking-[0.16em] text-ember">{t("order.tracking")}</h3>
              <p className="mt-2 leading-relaxed opacity-80">{order.trackingNote}</p>
            </div>
          )}
          <div className="border border-line p-6">
            <h3 className="font-display text-sm uppercase tracking-[0.16em]">{t("order.activity")}</h3>
            <ul className="mt-3 space-y-2.5 text-[12px]">
              {[...(order.history || [])].reverse().map((h, i) => (
                <li key={i} className="flex justify-between gap-4 opacity-70">
                  <span>{t(`status.${h.status}`)}{h.note ? ` — ${h.note}` : ""}</span>
                  <span className="shrink-0 opacity-60">{timeAgo(h.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
