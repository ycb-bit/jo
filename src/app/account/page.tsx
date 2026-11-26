"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/store";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, limit, doc, updateDoc } from "firebase/firestore";
import { formatMoney, timeAgo, cn } from "@/lib/utils";
import type { Order, Address } from "@/lib/types";
import {
  EMPTY_ADDRESS, missingAddressFields, normalizeAddresses, withAddress, withoutAddress,
} from "@/lib/addresses";
import { AddressCard } from "@/components/address-card";
import { AddressFields } from "@/components/address-fields";
import { BackButton } from "@/components/back-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useT } from "@/lib/i18n";

export default function AccountPage() {
  const { fbUser, profile, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useT();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"orders" | "addresses">("orders");
  const [ordersError, setOrdersError] = useState<string | null>(null);
  // Address book editor state. The list itself lives in Firestore (profile).
  const [draft, setDraft] = useState<Address>(EMPTY_ADDRESS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  /** The address waiting for a yes before it leaves the book. */
  const [addrToRemove, setAddrToRemove] = useState<Address | null>(null);

  useEffect(() => {
    if (!loading && !fbUser) router.replace("/login?next=/account");
  }, [loading, fbUser, router]);

  useEffect(() => {
    if (!fbUser) return;
    // One flat, auto-indexed query. Firestore refuses `where + orderBy` on
    // different fields without a composite index, and the swallowed error
    // made a full order history read as "No orders yet" forever — the same
    // failure the shop rack had. Newest-first is done here in JS instead.
    const q = query(collection(db, "orders"), where("userId", "==", fbUser.uid), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setOrders(rows);
        setOrdersError(null);
      },
      (err) => {
        // Never blank the page silently again — the message names the problem.
        setOrdersError(err.message || "Could not load your orders");
        setOrders([]);
      }
    );
  }, [fbUser]);

  if (loading || !profile) {
    return <div className="mx-auto max-w-[1440px] px-5 py-24"><div className="skeleton h-80 w-full" /></div>;
  }

  // ---- Address book -------------------------------------------------------
  // `profile` is a live listener (see auth-context), so writes come straight
  // back and both this page and checkout stay in sync.
  const book = normalizeAddresses(profile.addresses);

  const persist = async (next: Address[], okMessage: string) => {
    try {
      await updateDoc(doc(db, "users", fbUser!.uid), { addresses: next });
      toast(okMessage);
    } catch {
      toast(t("toast.saveFailed"), "err");
    }
  };

  const startNew = () => {
    setDraft({ ...EMPTY_ADDRESS });
    setEditingId(null);
    setMakeDefault(book.length === 0);
  };

  const startEdit = (a: Address) => {
    setDraft({ ...a });
    setEditingId(a.id || null);
    setMakeDefault(!!a.isDefault);
  };

  const saveAddress = async () => {
    const missing = missingAddressFields(draft);
    if (missing.length) {
      toast(t("co.stillNeeded", { fields: missing.map((f) => t(`address.${f}`)).join(", ") }), "err");
      return;
    }
    setSavingAddr(true);
    await persist(
      withAddress(book, { ...draft, isDefault: makeDefault }, { makeDefault }),
      editingId ? t("toast.addressUpdated") : t("toast.addressSaved")
    );
    setSavingAddr(false);
    startNew();
  };

  const removeAddress = async (id: string) =>
    persist(withoutAddress(book, id), t("toast.addressRemoved"));

  const makeDefaultAddress = async (id: string) =>
    persist(book.map((a) => ({ ...a, isDefault: a.id === id })), t("toast.defaultUpdated"));

  const statusTone = (s: string) =>
    s === "confirmed" || s === "shipped" || s === "delivered"
      ? "text-ember"
      : s === "rejected" || s === "cancelled"
        ? "text-red-700"
        : "opacity-70";

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-50">{t("account.signedInAs")}</p>
          <h1 className="font-display mt-1 text-5xl uppercase md:text-6xl">{profile.displayName}</h1>
          <p className="mt-1 text-[13px] opacity-60">{profile.email}</p>
        </div>
        <div className="flex gap-3 text-[11px] uppercase tracking-[0.18em]">
          {profile.role === "admin" && (
            <Link href="/admin" className="border border-ember px-4 py-2.5 text-ember transition-colors hover:bg-ember hover:text-bone">
              {t("account.adminStudio")}
            </Link>
          )}
          <button onClick={() => signOut(auth)} className="border border-line px-4 py-2.5 transition-colors hover:border-ink">
            {t("account.signOut")}
          </button>
        </div>
      </div>

      <div className="mt-10 flex gap-6 border-b border-line text-[12px] uppercase tracking-[0.18em]">
        {(["orders", "addresses"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("pb-3 transition-colors", tab === key ? "border-b-2 border-ink text-ink" : "opacity-50 hover:opacity-80")}
          >
            {key === "orders" ? t("account.ordersTab", { n: orders?.length ?? 0 }) : t("account.addressesTab")}
          </button>
        ))}
        <Link href="/wishlist" className="ml-auto pb-3 opacity-50 hover:opacity-80">{t("account.savedPieces")}</Link>
      </div>

      {tab === "orders" && (
        <div className="mt-8">
          {ordersError ? (
            <div className="border border-ember p-14 text-center">
              <p className="font-display text-2xl uppercase">{t("account.ordersUnavailable")}</p>
              <p className="mt-2 text-[13px] opacity-70">{ordersError}</p>
              <button onClick={() => router.refresh()} className="u-link mt-5 text-[12px] uppercase tracking-[0.2em]">{t("account.tryAgain")}</button>
            </div>
          ) : orders === null ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <div className="border border-line p-14 text-center">
              <p className="font-display text-2xl uppercase">{t("account.noOrders")}</p>
              <p className="mt-2 text-[13px] opacity-60">{t("account.noOrdersBody")}</p>
              <Link href="/shop" className="u-link mt-5 inline-block text-[12px] uppercase tracking-[0.2em]">{t("account.startShopping")}</Link>
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {orders.map((o) => {
                // A legacy or malformed doc can be missing items — guard once
                // here so one bad order can never blank the whole list.
                const items = o.items || [];
                return (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-5 transition-colors hover:bg-bone-dim/40">
                    <div className="min-w-0">
                      <p className="font-medium">{o.ref || o.id.slice(0, 10)}</p>
                      {/* What was actually ordered, named — "3 items · ETB…" alone
                          means opening every order to find the one being asked
                          about. First three pieces, then the overflow count. */}
                      <p className="mt-0.5 text-[12px] opacity-60">
                        {items.slice(0, 3).map((it) => `${it.name} ×${it.qty}`).join(" · ")}
                        {items.length > 3 && ` · ${t("account.more", { n: items.length - 3 })}`}
                      </p>
                      <p className="text-[11px] opacity-50 tabular-nums">
                        {timeAgo(o.createdAt)} · {items.length} item{items.length === 1 ? "" : "s"} · {formatMoney(o.total, o.currency)}
                      </p>
                    </div>
                    <span className={cn("text-[11px] uppercase tracking-[0.18em]", statusTone(o.status))}>
                      {t(`status.${o.status}`)}
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "addresses" && (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-sm uppercase tracking-[0.16em]">
                {t("account.savedAddresses", { n: book.length })}
              </h3>
              <button onClick={startNew} className="u-link text-[11px] uppercase tracking-[0.18em] text-ember">
                {t("account.addAddress")}
              </button>
            </div>

            {book.length === 0 ? (
              <p className="mt-6 border border-line p-10 text-center text-[13px] leading-relaxed opacity-60">
                {t("account.noAddresses")}
              </p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {book.map((a) => (
                  <li key={a.id}>
                    <AddressCard
                      address={a}
                      actions={
                        <>
                          {!a.isDefault && (
                            <button onClick={() => makeDefaultAddress(a.id!)} className="u-link text-ember">
                              {t("account.makeDefault")}
                            </button>
                          )}
                          <button onClick={() => startEdit(a)} className="u-link">{t("account.edit")}</button>
                          <button onClick={() => setAddrToRemove(a)} className="u-link text-red-700">
                            {t("account.remove")}
                          </button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 max-w-md text-[12px] leading-relaxed opacity-55">
              {t("account.defaultNote")}
            </p>
          </div>

          <div className="border border-ink p-6">
            <h3 className="font-display text-sm uppercase tracking-[0.16em]">
              {editingId ? t("account.editAddress") : t("account.addAnAddress")}
            </h3>
            <div className="mt-5">
              <AddressFields address={draft} onChange={setDraft} showLabel />
            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3 text-[12px]">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              {t("account.useAsDefault")}
            </label>

            <div className="mt-6 flex gap-3">
              <button
                onClick={saveAddress}
                disabled={savingAddr}
                className="flex-1 border border-ink bg-ink py-3 text-[11px] uppercase tracking-[0.2em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:opacity-50"
              >
                {savingAddr ? t("account.saving") : editingId ? t("account.saveChanges") : t("account.saveAddress")}
              </button>
              {editingId && (
                <button
                  onClick={startNew}
                  className="border border-line px-5 py-3 text-[11px] uppercase tracking-[0.2em] transition-colors hover:border-ink"
                >
                  {t("account.cancel")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deleting an address is one tap away and cannot be undone — ask first. */}
      <ConfirmDialog
        open={addrToRemove !== null}
        title={t("account.removeAddressTitle")}
        intro={t("account.removeAddressBody")}
        confirmLabel={t("account.removeAddress")}
        cancelLabel={t("account.keep")}
        onCancel={() => setAddrToRemove(null)}
        onConfirm={() => {
          const id = addrToRemove?.id;
          setAddrToRemove(null);
          if (id) void removeAddress(id);
        }}
      />
    </div>
  );
}
