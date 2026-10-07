"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart, useToast } from "@/lib/store";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { formatMoney } from "@/lib/utils";
import { compressImageToDataUri } from "@/lib/image-compress";
import { track } from "@/lib/analytics";
import type { Address, PaymentMethod, StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CartThumb } from "@/components/cart-thumb";
import { AddressCard } from "@/components/address-card";
import { OrderRef } from "@/components/order-ref";
import { AddressFields } from "@/components/address-fields";
import {
  EMPTY_ADDRESS, missingAddressFields, normalizeAddresses, withAddress,
} from "@/lib/addresses";
import { FadeIn as StepPanel } from "@/components/fade-in";

const FALLBACK_SETTINGS: StoreSettings = {
  currency: "ETB",
  handlingFee: 0,
  paymentMethods: [],
  categories: [],
  announcement: "",
};

export default function CheckoutPage() {
  const { fbUser, profile, loading: authLoading } = useAuth();
  const cart = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [settings, setSettings] = useState<StoreSettings>(FALLBACK_SETTINGS);
  // Address book: pick a saved card, or type a new one and save it for next time.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usingNew, setUsingNew] = useState(false);
  const [draft, setDraft] = useState<Address>(EMPTY_ADDRESS);
  const [saveToBook, setSaveToBook] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<{ id: string; ref: string; total: number } | null>(null);
  /** Frozen copy of where the order is going, shown while it is being paid. */
  const [shipTo, setShipTo] = useState<Address>(EMPTY_ADDRESS);
  const [file, setFile] = useState<File | null>(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [uploading, setUploading] = useState(false);
  const [payMethodId, setPayMethodId] = useState<string>("");
  const [submitError, setSubmitError] = useState("");
  const [copiedAcct, setCopiedAcct] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "store"), (snap) => {
      const d = snap.data();
      if (d) setSettings({ ...FALLBACK_SETTINGS, ...d } as StoreSettings);
    }, () => {});
  }, []);

  useEffect(() => {
    if (!authLoading && !fbUser) router.replace("/login?next=/checkout");
  }, [authLoading, fbUser, router]);

  useEffect(() => {
    if (!profile) return;
    // Pre-select the default saved address once the profile lands; a customer
    // with an empty book goes straight to the form.
    const list = normalizeAddresses(profile.addresses);
    if (list.length) {
      if (selectedId === null && !usingNew) {
        setSelectedId(list.find((a) => a.isDefault)?.id || list[0].id!);
      }
    } else if (!usingNew) {
      setUsingNew(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const subtotal = cart.subtotal();
  const total = subtotal;
  const methods: PaymentMethod[] = settings.paymentMethods || [];
  const method = methods.find((m) => m.id === payMethodId) || methods[0] || null;

  const book = normalizeAddresses(profile?.addresses);
  const picked = book.find((a) => a.id === selectedId) || null;
  const address: Address = usingNew ? draft : picked || EMPTY_ADDRESS;
  const missing = missingAddressFields(address);

  const editPicked = () => {
    setDraft(picked ? { ...picked } : { ...EMPTY_ADDRESS });
    setUsingNew(true);
    setSelectedId(null);
  };

  const backToBook = () => {
    setUsingNew(false);
    const list = normalizeAddresses(profile?.addresses);
    setSelectedId(list.find((a) => a.isDefault)?.id || list[0]?.id || null);
  };

  const continueToPayment = async () => {
    if (missing.length) {
      toast(`Still needed: ${missing.join(", ")}`, "err");
      return;
    }
    // A brand-new address can be kept for next time.
    if (usingNew && saveToBook) {
      try {
        await updateDoc(doc(db, "users", fbUser!.uid), {
          addresses: withAddress(book, { ...address, label: address.label || "New address", isDefault: book.length === 0 }, { makeDefault: book.length === 0 }),
        });
        toast("Address saved to your account");
      } catch {
        toast("Order continues — but we could not save that address", "err");
      }
    }
    // Step 2 only makes sense once the order exists, so create it here. Doing
    // this the button's job is what made "Pay & prove" render as an empty page.
    await placeOrder();
  };

  /** Account numbers get mistyped digit-by-digit from a screen — copy beats squinting. */
  const copyAccountNumber = async () => {
    if (!method?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(method.accountNumber);
      setCopiedAcct(true);
      setTimeout(() => setCopiedAcct(false), 2000);
    } catch {
      setCopiedAcct(false);
    }
  };

  const placeOrder = async () => {
    if (missing.length) {
      toast(`Still needed: ${missing.join(", ")}`, "err");
      return;
    }
    setPlacing(true);
    try {
      const token = await fbUser!.getIdToken();
      // Strip the address-book bookkeeping fields — the order only needs where
      // the cloth is going.
      const shippingAddress: Address = {
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 || "",
        city: address.city,
        subCity: address.subCity || "",
        postalCode: address.postalCode || "",
        country: address.country || "Ethiopia",
        phone: address.phone,
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.lines.map((l) => ({
            productId: l.productId, slug: l.slug, name: l.name, color: l.color,
            size: l.size, qty: l.qty, unitPrice: l.unitPrice,
          })),
          shippingAddress,
          paymentMethodId: method?.id || "",
          paymentMethodName: method?.name || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order");
      track("begin_checkout", { ref: data.orderId, value: data.total });
      setOrder({ id: data.orderId, ref: data.ref, total: data.total });
      setShipTo(shippingAddress);
      setStep(2);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Order failed", "err");
    } finally {
      setPlacing(false);
    }
  };

  const uploadReceipt = async () => {
    if (!file || !order) return;
    setUploading(true);
    try {
      // Compress in the browser → data URI straight into the order doc. No bucket.
      const dataUri = await compressImageToDataUri(file, 1400, 0.72);
      const token = await fbUser!.getIdToken();
      const res = await fetch("/api/orders/receipt/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, dataUri, name: file.name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Receipt upload failed");
      }
      setStep(3);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "err");
    } finally {
      setUploading(false);
    }
  };

  const submitForVerification = async () => {
    setSubmitError("");
    if (!order || receiptRef.trim().length < 3) {
      setSubmitError("Type the reference your bank or telebirr app gave you.");
      toast("Type the bank reference from your transfer", "err");
      return;
    }
    setUploading(true);
    try {
      const token = await fbUser!.getIdToken();
      const res = await fetch("/api/orders/receipt/submit", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: order.id,
          receiptRef: receiptRef.trim(),
          paymentMethodId: method?.id || "",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Submit failed");
      cart.clear();
      track("receipt_submitted", { ref: order.id, name: receiptRef.trim() });
      toast(
        d.receiptMissing
          ? "Submitted — Jo will match the reference in the statement"
          : "Receipt submitted — Jo will verify it shortly"
      );
      router.push(`/order/${order.id}`);
    } catch (err) {
      // Keep the message on the page too: a toast alone disappears before it is read.
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
      toast(err instanceof Error ? err.message : "Submit failed", "err");
    } finally {
      setUploading(false);
    }
  };

  // Receipt upload to server goes through Storage rules directly; the API confirms metadata.
  if (authLoading) {
    return <div className="mx-auto max-w-[1440px] px-5 py-24"><div className="skeleton h-96 w-full" /></div>;
  }

  if (cart.lines.length === 0 && !order) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-32 text-center md:px-10">
        <h1 className="font-display text-5xl uppercase">Nothing to check out</h1>
        <Link href="/shop" className="u-link mt-6 inline-block text-[12px] uppercase tracking-[0.2em]">← Back to the rack</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      {/* Stepper */}
      <div className="mb-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em]">
        {["Details", "Pay & prove", "Done"].map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className={cn("flex h-7 w-7 items-center justify-center border", step > i ? "border-ink bg-ink text-bone" : "border-line opacity-50")}>
              {i + 1}
            </span>
            <span className={cn(step > i ? "" : "opacity-50")}>{label}</span>
            {i < 2 && <span className="mx-2 h-px w-8 bg-line md:w-14" />}
          </div>
        ))}
      </div>

      <div className="grid gap-14 lg:grid-cols-[1fr_400px]">
        <div>
          {/* STEP 1 — Address. Also the fallback whenever there is no order yet, so a
              blank left column can never happen. */}
          {(step === 1 || !order) && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Where it&apos;s going</h1>

              {book.length > 0 && !usingNew && (
                <div className="mt-8">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Ship to</p>
                  <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                    {book.map((a) => (
                      <li key={a.id}>
                        <AddressCard
                          address={a}
                          selected={a.id === selectedId}
                          onSelect={() => setSelectedId(a.id!)}
                        />
                      </li>
                    ))}
                  </ul>
                  <button onClick={editPicked} className="u-link mt-5 text-[12px] uppercase tracking-[0.2em] text-ember">
                    {picked ? "Edit this address" : "+ Use a different address"}
                  </button>
                </div>
              )}

              {usingNew && (
                <div className="mt-8">
                  {book.length > 0 && (
                    <button onClick={backToBook} className="u-link mb-5 text-[11px] uppercase tracking-[0.18em] text-ember">
                      ← Back to saved addresses
                    </button>
                  )}
                  <AddressFields address={draft} onChange={setDraft} showLabel={book.length > 0} />

                  {book.length > 0 && (
                    <label className="mt-6 flex cursor-pointer items-center gap-3 border border-line p-4 text-[12px] leading-relaxed">
                      <input
                        type="checkbox"
                        checked={saveToBook}
                        onChange={(e) => setSaveToBook(e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-ember"
                      />
                      <span>
                        Save this address to my account — next time checkout is one tap.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {missing.length > 0 && (
                <p className="mt-5 text-[12px] text-ember">
                  Still needed: {missing.join(", ")}
                </p>
              )}

              <button
                onClick={continueToPayment}
                disabled={missing.length > 0 || placing}
                className="mt-8 w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
              >
                {placing ? "Placing your order…" : "Continue to payment →"}
              </button>
              <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] opacity-50">
                Nothing is charged here — you pay by bank transfer on the next step
              </p>
            </StepPanel>
          )}

          {/* STEP 2 — Payment instructions */}
          {step === 2 && order && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Pay it</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
                Order reserved. Pick how you&apos;re paying, send the exact amount, then upload
                your receipt so Jo can verify it.
              </p>

              <OrderRef value={order.ref} className="mt-8" />

              {/* Submitting the bank reference is the one required step — the
                  receipt photo is optional and intentionally quiet, secondary
                  to the core product. */}
              <div className="mt-8 max-w-md">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Shipping to</p>
                <div className="mt-3">
                  <AddressCard address={shipTo} />
                </div>
              </div>

              {/* Payment method picker */}
              {methods.length > 0 && (
                <div className="mt-8">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Payment method</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethodId(m.id)}
                        className={cn(
                          "border p-4 text-left text-[13px] transition-colors",
                          method?.id === m.id ? "border-ink bg-ink text-bone" : "border-line hover:border-ink"
                        )}
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className={cn("block text-[11px] uppercase tracking-[0.14em] mt-1", method?.id === m.id ? "opacity-70" : "opacity-50")}>
                          {m.type === "bank" ? "Bank transfer" : "Payment link"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 border border-ink p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Amount to send</p>
                  <p className="font-display text-4xl tabular-nums">{formatMoney(order.total, settings.currency)}</p>
                </div>
                {method ? (
                  <div className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
                    {method.type === "bank" ? (
                      <>
                        <p className="flex justify-between"><span className="opacity-60">Bank</span><span>{method.name}</span></p>
                        {method.accountName && <p className="flex justify-between"><span className="opacity-60">Account name</span><span>{method.accountName}</span></p>}
                        {method.accountNumber && (
                          <p className="flex items-center justify-between gap-3">
                            <span className="opacity-60">Account number</span>
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums select-all">{method.accountNumber}</span>
                              <button
                                onClick={copyAccountNumber}
                                className="border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors hover:border-ink"
                              >
                                {copiedAcct ? "Copied ✓" : "Copy"}
                              </button>
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="flex justify-between"><span className="opacity-60">Payment link</span>
                        <a href={method.url} target="_blank" rel="noreferrer" className="u-link font-medium text-ember">
                          Open {method.name} ↗
                        </a>
                      </p>
                    )}
                    {method.instructions && <p className="border-t border-line pt-3 leading-relaxed opacity-70">{method.instructions}</p>}
                    <p className="flex justify-between"><span className="opacity-60">Payment reference</span><span className="font-medium">{order.ref}</span></p>
                  </div>
                ) : (
                  <p className="mt-5 border-t border-line pt-5 text-[13px] leading-relaxed opacity-70">
                    Payment details are being set up — you can still place the order and pay
                    later from your account page, or reach Jo directly.
                  </p>
                )}
              </div>

              <div className="mt-6 max-w-md">
                <label className="text-[11px] uppercase tracking-[0.2em] opacity-60">
                  {method?.type === "bank" ? `${method.name} transfer reference` : "Payment reference"}
                </label>
                <input
                  className="input mt-2"
                  placeholder="e.g. FT240812ABCD"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-2 text-[12px] leading-relaxed opacity-55">
                  {method?.type === "bank"
                    ? "The code your bank or telebirr app generated after the transfer."
                    : "The code your payment confirmation shows."}
                </p>
              </div>

              {/* Optional, deliberately IS quiet: most customers just type the
                  reference. The photo only helps when the statement match is
                  near-absent, e.g. it failed once. */}
              <details className="mt-5 max-w-md text-[13px]">
                <summary className="cursor-pointer select-none text-[12px] opacity-50 transition-opacity hover:opacity-80">
                  {file ? `Receipt photo attached — ${Math.round(file.size / 1024)} KB` : "Add a receipt photo (optional)"}
                </summary>
                <label className="mt-3 flex cursor-pointer items-center justify-center border border-dashed border-line p-6 text-center transition-colors hover:border-ink">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <span className="text-[12px] opacity-60">{file ? "Choose a different file — JPG, PNG or HEIC" : "Click to choose — JPG, PNG or HEIC"}</span>
                </label>
                {file && (
                  <button onClick={uploadReceipt} disabled={uploading} className="u-link mt-3 text-[11px] uppercase tracking-[0.18em] text-ember">
                    {uploading ? "Uploading…" : "Attach it to this order →"}
                  </button>
                )}
              </details>

              <button
                onClick={submitForVerification}
                disabled={uploading || receiptRef.trim().length < 3}
                className="mt-8 w-full max-w-md border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? "Submitting…" : "Submit & finish →"}
              </button>
              {submitError && (
                <p className="mt-4 max-w-md border border-ember p-4 text-[13px] leading-relaxed text-ember">
                  {submitError}
                </p>
              )}
            </StepPanel>
          )}

          {/* STEP 3 — Done: order received, payment being matched */}
          {step === 3 && order && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Done</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
                Order received. Jo matches your transfer in the account, usually within a few
                hours, and you&apos;ll see the status move live.
              </p>

              {/* What Jo is matching, so &quot;which transfer?&quot; never comes up. */}
              <div className="mt-6 max-w-md border border-line p-5 text-[13px]">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">What Jo is matching</p>
                <div className="mt-2 space-y-1.5">
                  <p className="flex justify-between gap-4">
                    <span className="opacity-60">Transfer</span>
                    <span className="text-right font-medium">{receiptRef.trim()}</span>
                  </p>
                  {method && (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Method</span>
                      <span className="text-right">{method.name}</span>
                    </p>
                  )}
                  {method?.type === "bank" && method.accountNumber && (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Account</span>
                      <span className="tabular-nums select-all">{method.accountNumber}</span>
                    </p>
                  )}
                  {file ? (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Receipt photo</span>
                      <span className="text-right">Attached ✓</span>
                    </p>
                  ) : (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Receipt photo</span>
                      <span className="text-right opacity-50">Not needed</span>
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed opacity-55">
                Watch the status live from your account, or search{" "}
                <Link href="/track" className="u-link">{order.ref}</Link> any time. If it&apos;s
                rejected you&apos;ll be able to submit a new receipt.
              </p>
            </StepPanel>
          )}
        </div>

        {/* Order summary rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-line p-6">
            <h2 className="font-display text-lg uppercase">Order</h2>
            <ul className="mt-4 space-y-4">
              {cart.lines.map((l) => (
                <li key={`${l.productId}-${l.color}-${l.size}`} className="flex items-center gap-3">
                  <div className="h-16 shrink-0 overflow-hidden bg-bone-dim" style={{ width: 52 }}>
                    <CartThumb image={l.image} seed={l.slug} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 text-[13px]">
                    <p className="font-medium">{l.name}</p>
                    <p className="opacity-50">{l.color} / {l.size} × {l.qty}</p>
                  </div>
                  <p className="text-[13px] tabular-nums">{formatMoney(l.unitPrice * l.qty)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between"><dt className="opacity-60">{cart.lines.length} item{cart.lines.length === 1 ? "" : "s"}</dt><dd className="tabular-nums">{formatMoney(subtotal)}</dd></div>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] opacity-50"><dt>Shipping</dt><dd>Free, always</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>Total</dt><dd className="tabular-nums">{formatMoney(total)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
