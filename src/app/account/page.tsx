"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/store";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { formatMoney, timeAgo, cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type Order, type Address } from "@/lib/types";
import {
  EMPTY_ADDRESS, missingAddressFields, normalizeAddresses, withAddress, withoutAddress,
} from "@/lib/addresses";
import { AddressCard } from "@/components/address-card";
import { AddressFields } from "@/components/address-fields";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AccountPage() {
  const { fbUser, profile, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"orders" | "addresses">("orders");
  // Address book editor state. The list itself lives in Firestore (profile).
  const [draft, setDraft] = useState<Address>(EMPTY_ADDRESS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    if (!loading && !fbUser) router.replace("/login?next=/account");
  }, [loading, fbUser, router]);

  useEffect(() => {
    if (!fbUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", fbUser.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]), () => setOrders([]));
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
      toast("Could not save — check your connection", "err");
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
      toast(`Still needed: ${missing.join(", ")}`, "err");
      return;
    }
    setSavingAddr(true);
    await persist(
      withAddress(book, { ...draft, isDefault: makeDefault }, { makeDefault }),
      editingId ? "Address updated" : "Address saved"
    );
    setSavingAddr(false);
    startNew();
  };

  const removeAddress = async (id: string) =>
    persist(withoutAddress(book, id), "Address removed");

  const makeDefaultAddress = async (id: string) =>
    persist(book.map((a) => ({ ...a, isDefault: a.id === id })), "Default address updated");

  const statusTone = (s: string) =>
    s === "confirmed" || s === "shipped" || s === "delivered"
      ? "text-ember"
      : s === "rejected" || s === "cancelled"
        ? "text-red-700"
        : "opacity-70";

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-14 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-50">Signed in as</p>
          <h1 className="font-display mt-1 text-5xl uppercase md:text-6xl">{profile.displayName}</h1>
          <p className="mt-1 text-[13px] opacity-60">{profile.email}</p>
        </div>
        <div className="flex gap-3 text-[11px] uppercase tracking-[0.18em]">
          {profile.role === "admin" && (
            <Link href="/admin" className="border border-ember px-4 py-2.5 text-ember transition-colors hover:bg-ember hover:text-bone">
              Admin studio
            </Link>
          )}
          <button onClick={() => signOut(auth)} className="border border-line px-4 py-2.5 transition-colors hover:border-ink">
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-10 flex gap-6 border-b border-line text-[12px] uppercase tracking-[0.18em]">
        {(["orders", "addresses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("pb-3 transition-colors", tab === t ? "border-b-2 border-ink text-ink" : "opacity-50 hover:opacity-80")}
          >
            {t === "orders" ? `Orders (${orders?.length ?? 0})` : "Address book"}
          </button>
        ))}
        <Link href="/wishlist" className="ml-auto pb-3 opacity-50 hover:opacity-80">Saved pieces →</Link>
      </div>

      {tab === "orders" && (
        <div className="mt-8">
          {orders === null ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <div className="border border-line p-14 text-center">
              <p className="font-display text-2xl uppercase">No orders yet</p>
              <p className="mt-2 text-[13px] opacity-60">When you place one, it appears here with live status.</p>
              <Link href="/shop" className="u-link mt-5 inline-block text-[12px] uppercase tracking-[0.2em]">Start shopping →</Link>
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-5 transition-colors hover:bg-bone-dim/40">
                    <div>
                      <p className="font-medium">{o.ref || o.id.slice(0, 10)}</p>
                      <p className="text-[12px] opacity-50">
                        {timeAgo(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? "" : "s"} · {formatMoney(o.total, o.currency)}
                      </p>
                    </div>
                    <span className={cn("text-[11px] uppercase tracking-[0.18em]", statusTone(o.status))}>
                      {ORDER_STATUS_LABEL[o.status] || o.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "addresses" && (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-sm uppercase tracking-[0.16em]">
                Saved addresses ({book.length})
              </h3>
              <button onClick={startNew} className="u-link text-[11px] uppercase tracking-[0.18em] text-ember">
                + Add address
              </button>
            </div>

            {book.length === 0 ? (
              <p className="mt-6 border border-line p-10 text-center text-[13px] leading-relaxed opacity-60">
                No saved addresses yet. Add one on the right and checkout becomes a single tap —
                we&apos;ll pre-select it every time.
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
                              Make default
                            </button>
                          )}
                          <button onClick={() => startEdit(a)} className="u-link">Edit</button>
                          <button onClick={() => removeAddress(a.id!)} className="u-link text-red-700">
                            Remove
                          </button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 max-w-md text-[12px] leading-relaxed opacity-55">
              Your default address is the one checkout picks for you — change it any time with
              &ldquo;Make default&rdquo;.
            </p>
          </div>

          <div className="border border-ink p-6">
            <h3 className="font-display text-sm uppercase tracking-[0.16em]">
              {editingId ? "Edit address" : "Add an address"}
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
              Use as my default address
            </label>

            <div className="mt-6 flex gap-3">
              <button
                onClick={saveAddress}
                disabled={savingAddr}
                className="flex-1 border border-ink bg-ink py-3 text-[11px] uppercase tracking-[0.2em] text-bone transition-colors hover:border-ember hover:bg-ember disabled:opacity-50"
              >
                {savingAddr ? "Saving…" : editingId ? "Save changes" : "Save address"}
              </button>
              {editingId && (
                <button
                  onClick={startNew}
                  className="border border-line px-5 py-3 text-[11px] uppercase tracking-[0.2em] transition-colors hover:border-ink"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
