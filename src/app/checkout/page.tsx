"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart, useToast } from "@/lib/store";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { formatMoney } from "@/lib/utils";
import { compressImageToDataUri } from "@/lib/image-compress";
import { track } from "@/lib/analytics";
import type { Address, PaymentMethod, StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductArt } from "@/components/product-art";
import { FadeIn as StepPanel } from "@/components/fade-in";

const EMPTY: Address = {
  fullName: "", line1: "", line2: "", city: "", subCity: "", region: "", postalCode: "", country: "Ethiopia", phone: "",
};

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
  const [address, setAddress] = useState<Address>(EMPTY);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<{ id: string; ref: string; total: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [uploading, setUploading] = useState(false);
  const [payMethodId, setPayMethodId] = useState<string>("");

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
    if (profile?.addresses?.length && address.fullName === "") {
      setAddress(profile.addresses[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const subtotal = cart.subtotal();
  const total = subtotal;
  const methods: PaymentMethod[] = settings.paymentMethods || [];
  const method = methods.find((m) => m.id === payMethodId) || methods[0] || null;

  const field = (key: keyof Address, label: string, opts?: { type?: string; required?: boolean; half?: boolean }) => (
    <label className={cn("block", opts?.half && "sm:col-span-1", !opts?.half && "sm:col-span-2")}>
      <input
        className="input"
        type={opts?.type || "text"}
        required={opts?.required !== false}
        placeholder={label}
        value={address[key]}
        onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
        autoComplete={
          { fullName: "name", line1: "address-line1", line2: "address-line2", city: "address-level2",
            subCity: "address-level3", region: "address-level1", postalCode: "postal-code", country: "country-name", phone: "tel" }[key]
        }
      />
    </label>
  );

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const token = await fbUser!.getIdToken();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.lines.map((l) => ({
            productId: l.productId, slug: l.slug, name: l.name, color: l.color,
            size: l.size, qty: l.qty, unitPrice: l.unitPrice,
          })),
          shippingAddress: address,
          paymentMethodId: method?.id || "",
          paymentMethodName: method?.name || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order");
      track("begin_checkout", { ref: data.orderId, value: data.total });
      setOrder({ id: data.orderId, ref: data.ref, total: data.total });
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
    if (!order || receiptRef.trim().length < 3) {
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
      toast("Receipt submitted — Jo will verify it shortly");
      router.push(`/order/${order.id}`);
    } catch (err) {
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
          {/* STEP 1 — Address */}
          {step === 1 && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Where it&apos;s going</h1>
              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={(e) => { e.preventDefault(); setStep(2); window.scrollTo({ top: 0 }); }}
              >
                {field("fullName", "Full name", { half: true })}
                {field("phone", "Phone", { half: true, type: "tel" })}
                {field("line1", "Street / landmark — e.g. Bole Rwanda St, near Getu Commercial")}
                {field("line2", "Apartment, building, office (optional)", { required: false })}
                {field("city", "City", { half: true })}
                {field("subCity", "Sub-city / woreda — e.g. Bole, Yeka, Arada", { half: true, required: false })}
                {field("region", "Region", { half: true })}
                <button
                  className="mt-4 border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember sm:col-span-2"
                >
                  Continue to payment →
                </button>
              </form>
            </StepPanel>
          )}

          {/* STEP 2 — Payment instructions */}
          {step === 2 && order && (
            <StepPanel>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Pay it</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
                Order <strong>{order.ref}</strong> is reserved. Pick how you&apos;re paying, send
                the exact amount, then upload your receipt so Jo can verify it.
              </p>

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
                        {method.accountNumber && <p className="flex justify-between"><span className="opacity-60">Account number</span><span className="tabular-nums select-all">{method.accountNumber}</span></p>}
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

              <div className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Upload bank receipt (screenshot or PDF-style photo)</p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center border border-dashed border-ink/30 p-10 text-center transition-colors hover:border-ink">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <span className="text-[13px]"><strong>{file.name}</strong> — {Math.round(file.size / 1024)} KB ✓</span>
                  ) : (
                    <span className="text-[13px] opacity-60">Click to choose a file — JPG, PNG or HEIC</span>
                  )}
                </label>
                <button
                  onClick={uploadReceipt}
                  disabled={!file || uploading}
                  className="mt-4 w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? "Uploading…" : "Upload receipt →"}
                </button>
                {file && (
                  <button onClick={() => setStep(3)} className="u-link mt-4 block text-[11px] uppercase tracking-[0.18em] opacity-60">
                    Skip for now — finish from your account later
                  </button>
                )}
              </div>
            </StepPanel>
          )}

          {/* STEP 3 — Reference + submit */}
          {step === 3 && order && (
            <StepPanel>
              <h1 className="font-display text-4xl uppercase md:text-5xl">Last thing</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">
                Type the transfer reference from your banking app so Jo can match your payment
                to <strong>{order.ref}</strong> in the account.
              </p>

              {/* Which bank they paid from — repeated here so the reference is
                  never submitted without the account it belongs to. */}
              <div className="mt-6 max-w-md border border-line p-5 text-[13px]">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">You paid via</p>
                {method ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Method</span>
                      <span className="text-right font-medium">{method.name}</span>
                    </p>
                    {method.type === "bank" && method.accountNumber && (
                      <p className="flex justify-between gap-4">
                        <span className="opacity-60">Account</span>
                        <span className="tabular-nums select-all">{method.accountNumber}</span>
                      </p>
                    )}
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">Order</span>
                      <span className="tabular-nums">{order.ref}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 leading-relaxed opacity-70">
                    No method was recorded — type the reference anyway and Jo will confirm.
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
                    ? "This is the code your bank or telebirr app generated. Jo looks for exactly this in the account statement."
                    : "Copy this from your payment confirmation so Jo can match it to your order."}
                </p>
                <button
                  onClick={submitForVerification}
                  disabled={uploading || receiptRef.trim().length < 3}
                  className="mt-6 w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? "Submitting…" : "Submit for verification"}
                </button>
                <p className="mt-4 text-[12px] leading-relaxed opacity-55">
                  Verification is done by Jo himself — usually within a few hours. You can watch
                  the status live from your account. If it&apos;s rejected you&apos;ll be able to
                  submit a new receipt from this page.
                </p>
              </div>
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
                    <ProductArt seed={l.slug} className="h-full w-full" />
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
