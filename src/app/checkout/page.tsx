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
import { BackButton } from "@/components/back-button";
import { useT } from "@/lib/i18n";

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
  const { t } = useT();

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
      toast(t("co.stillNeeded", { fields: missing.map((f) => t(`address.${f}`)).join(", ") }), "err");
      return;
    }
    // A brand-new address can be kept for next time.
    if (usingNew && saveToBook) {
      try {
        await updateDoc(doc(db, "users", fbUser!.uid), {
          addresses: withAddress(book, { ...address, label: address.label || "New address", isDefault: book.length === 0 }, { makeDefault: book.length === 0 }),
        });
        toast(t("toast.addressSavedToAccount"));
      } catch {
        toast(t("toast.addressUnsaved"), "err");
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
      toast(t("co.stillNeeded", { fields: missing.map((f) => t(`address.${f}`)).join(", ") }), "err");
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
        country: address.country,
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
      toast(err instanceof Error ? err.message : t("toast.orderFailed"), "err");
    } finally {
      setPlacing(false);
    }
  };

  /**
   * One action: compress the photo, attach it to the order, then submit it for
   * verification. The image is the verification now — the reference number is
   * only extra evidence, so nothing here depends on it.
   */
  const uploadAndSubmit = async () => {
    setSubmitError("");
    if (!order) return;
    if (!file) {
      setSubmitError(t("toast.pickReceipt"));
      toast(t("toast.addReceiptFirst"), "err");
      return;
    }
    setUploading(true);
    try {
      const dataUri = await compressImageToDataUri(file, 1400, 0.72);
      const token = await fbUser!.getIdToken();
      const up = await fetch("/api/orders/receipt/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, dataUri, name: file.name }),
      });
      if (!up.ok) {
        const d = await up.json().catch(() => ({}));
        throw new Error(d.error || "Receipt upload failed");
      }

      const res = await fetch("/api/orders/receipt/submit", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: order.id,
          receiptRef: receiptRef.trim(),
          paymentMethodId: method?.id || "",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The photo is already saved, so the order is not stuck — finish from
        // the order page instead of making them upload it again.
        setSubmitError(d.error || t("co.receiptSavedFailed"));
        toast(t("toast.receiptSavedOpen"), "err");
        router.push(`/order/${order.id}`);
        return;
      }
      cart.clear();
      track("receipt_submitted", { ref: order.id, name: file.name });
      toast(t("toast.receiptSubmittedJo"));
      router.push(`/order/${order.id}`);
    } catch (err) {
      // Keep the message on the page too: a toast alone disappears before it is read.
      setSubmitError(err instanceof Error ? err.message : t("toast.uploadFailed"));
      toast(err instanceof Error ? err.message : t("toast.uploadFailed"), "err");
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
        <BackButton />
        <h1 className="font-display text-5xl uppercase">{t("co.nothingTitle")}</h1>
        <Link href="/shop" className="u-link mt-6 inline-block text-[12px] uppercase tracking-[0.2em]">{t("product.backToRack")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      {/* Stepper */}
      <div className="mb-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em]">
        {[t("co.step1"), t("co.step2"), t("co.step3")].map((label, i) => (
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
              <h1 className="font-display text-4xl uppercase md:text-5xl">{t("co.whereGoing")}</h1>

              {book.length > 0 && !usingNew && (
                <div className="mt-8">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("co.shipTo")}</p>
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
                    {picked ? t("co.editAddress") : t("co.useDifferent")}
                  </button>
                </div>
              )}

              {usingNew && (
                <div className="mt-8">
                  {book.length > 0 && (
                    <button onClick={backToBook} className="u-link mb-5 text-[11px] uppercase tracking-[0.18em] text-ember">
                      {t("co.backToSaved")}
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
                        {t("co.saveAddress")}
                      </span>
                    </label>
                  )}
                </div>
              )}

              {missing.length > 0 && (
                <p className="mt-5 text-[12px] text-ember">
                  {t("co.stillNeeded", { fields: missing.join(", ") })}
                </p>
              )}

              <button
                onClick={continueToPayment}
                disabled={missing.length > 0 || placing}
                className="mt-8 w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
              >
                {placing ? t("co.placing") : t("co.continue")}
              </button>
              <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] opacity-50">
                {t("co.noCharge")}
              </p>
            </StepPanel>
          )}

          {/* STEP 2 — Payment instructions */}
          {step === 2 && order && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">{t("co.payTitle")}</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">{t("co.payBody")}</p>

              <OrderRef value={order.ref} className="mt-8" />

              {/* Submitting the bank reference is the one required step — the
                  receipt photo is optional and intentionally quiet, secondary
                  to the core product. */}
              <div className="mt-8 max-w-md">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("co.shippingTo")}</p>
                <div className="mt-3">
                  <AddressCard address={shipTo} />
                </div>
              </div>

              {/* Payment method picker */}
              {methods.length > 0 && (
                <div className="mt-8">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("co.paymentMethod")}</p>
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
                          {m.type === "bank" ? t("co.bankTransfer") : t("co.paymentLink")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 border border-ink p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("co.amountToSend")}</p>
                  <p className="font-display text-4xl tabular-nums">{formatMoney(order.total, settings.currency)}</p>
                </div>
                {method ? (
                  <div className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
                    {method.type === "bank" ? (
                      <>
                        <p className="flex justify-between"><span className="opacity-60">{t("co.bank")}</span><span>{method.name}</span></p>
                        {method.accountName && <p className="flex justify-between"><span className="opacity-60">{t("co.accountName")}</span><span>{method.accountName}</span></p>}
                        {method.accountNumber && (
                          <p className="flex items-center justify-between gap-3">
                            <span className="opacity-60">{t("co.accountNumber")}</span>
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums select-all">{method.accountNumber}</span>
                              <button
                                onClick={copyAccountNumber}
                                className="border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors hover:border-ink"
                              >
                                {copiedAcct ? t("co.copied") : t("co.copy")}
                              </button>
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="flex justify-between"><span className="opacity-60">{t("co.paymentLink")}</span>
                        <a href={method.url} target="_blank" rel="noreferrer" className="u-link font-medium text-ember">
                          {t("co.openLink", { name: method.name })}
                        </a>
                      </p>
                    )}
                    {method.instructions && <p className="border-t border-line pt-3 leading-relaxed opacity-70">{method.instructions}</p>}
                    <p className="flex justify-between"><span className="opacity-60">{t("co.paymentReference")}</span><span className="font-medium">{order.ref}</span></p>
                  </div>
                ) : (
                  <p className="mt-5 border-t border-line pt-5 text-[13px] leading-relaxed opacity-70">
                    {t("co.noMethodNote")}
                  </p>
                )}
              </div>

              {/* The receipt photo is the verification — this is the one
                  required step. The bank reference is optional extra evidence. */}
              <div className="mt-8 max-w-md">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">
                  {t("co.uploadReceipt")}
                </p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center border border-dashed border-ink/30 p-8 text-center transition-colors hover:border-ink">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <span className="text-[13px]"><strong>{file.name}</strong> — {Math.round(file.size / 1024)} KB ✓</span>
                  ) : (
                    <span className="text-[13px] opacity-60">{t("co.chooseFile")}</span>
                  )}
                </label>

                <label className="mt-5 block text-[11px] uppercase tracking-[0.2em] opacity-60">
                  {t("co.reference")} <span className="normal-case tracking-normal">{t("co.optional")}</span>
                </label>
                <input
                  className="input mt-2"
                  placeholder="e.g. FT240812ABCD"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />

                <button
                  onClick={uploadAndSubmit}
                  disabled={uploading || !file}
                  className="mt-6 w-full border border-ink bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? t("co.uploading") : t("co.uploadFinish")}
                </button>
                {submitError && (
                  <p className="mt-4 border border-ember p-4 text-[13px] leading-relaxed text-ember">
                    {submitError}
                  </p>
                )}
              </div>
            </StepPanel>
          )}

          {/* STEP 3 — Done: order received, payment being matched */}
          {step === 3 && order && (
            <StepPanel animate={false}>
              <h1 className="font-display text-4xl uppercase md:text-5xl">{t("co.step3")}</h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed opacity-70">{t("co.doneBody")}</p>

              {/* What Jo is matching, so &quot;which transfer?&quot; never comes up. */}
              <div className="mt-6 max-w-md border border-line p-5 text-[13px]">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("co.matching")}</p>
                <div className="mt-2 space-y-1.5">
                  <p className="flex justify-between gap-4">
                    <span className="opacity-60">{t("co.receipt")}</span>
                    <span className="text-right font-medium">{t("co.imageAttached")}</span>
                  </p>
                  {receiptRef.trim() && (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">{t("co.referenceLabel")}</span>
                      <span className="text-right tabular-nums">{receiptRef.trim()}</span>
                    </p>
                  )}
                  {method && (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">{t("co.method")}</span>
                      <span className="text-right">{method.name}</span>
                    </p>
                  )}
                  {method?.type === "bank" && method.accountNumber && (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">{t("co.account")}</span>
                      <span className="tabular-nums select-all">{method.accountNumber}</span>
                    </p>
                  )}
                  {file ? (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">{t("co.receiptPhoto")}</span>
                      <span className="text-right">{t("co.attached")}</span>
                    </p>
                  ) : (
                    <p className="flex justify-between gap-4">
                      <span className="opacity-60">{t("co.receiptPhoto")}</span>
                      <span className="text-right opacity-50">{t("co.notNeeded")}</span>
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed opacity-55">
                {t("co.doneNote")}{" "}
                <Link href="/track" className="u-link">{order.ref}</Link>
              </p>
            </StepPanel>
          )}
        </div>

        {/* Order summary rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-line p-6">
            <h2 className="font-display text-lg uppercase">{t("co.order")}</h2>
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
              <div className="flex justify-between"><dt className="opacity-60">{t(cart.lines.length === 1 ? "co.items" : "co.itemsPlural", { n: cart.lines.length })}</dt><dd className="tabular-nums">{formatMoney(subtotal)}</dd></div>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] opacity-50"><dt>{t("cart.shipping")}</dt><dd>{t("co.shippingFree")}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>{t("cart.total")}</dt><dd className="tabular-nums">{formatMoney(total)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
