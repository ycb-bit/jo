"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/store";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { formatMoney, timeAgo, cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type Order, type Address } from "@/lib/types";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const EMPTY_ADDR: Address = {
  fullName: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "", phone: "",
};

export default function AccountPage() {
  const { fbUser, profile, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"orders" | "addresses">("orders");
  const [newAddr, setNewAddr] = useState<Address>(EMPTY_ADDR);

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

  const saveAddress = async () => {
    if (!fbUser || !newAddr.line1 || !newAddr.city) {
      toast("Name, street and city are required", "err");
      return;
    }
    await updateDoc(doc(db, "users", fbUser.uid), { addresses: arrayUnion(newAddr) });
    setNewAddr(EMPTY_ADDR);
    toast("Address saved");
  };

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
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            {profile.addresses?.length === 0 && (
              <p className="text-[13px] opacity-60">No saved addresses yet — add one to speed up checkout.</p>
            )}
            {profile.addresses?.map((a, i) => (
              <div key={i} className="border border-line p-5 text-[13px] leading-relaxed">
                <p className="font-medium">{a.fullName}</p>
                <p className="opacity-70">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                <p className="opacity-70">{a.city}, {a.region} {a.postalCode}</p>
                <p className="opacity-70">{a.country} · {a.phone}</p>
              </div>
            ))}
          </div>
          <div className="border border-ink p-6">
            <h3 className="font-display text-sm uppercase tracking-[0.16em]">Add an address</h3>
            <div className="mt-4 space-y-3">
              {(["fullName", "line1", "line2", "city", "region", "postalCode", "country", "phone"] as const).map((k) => (
                <input
                  key={k}
                  className="input"
                  placeholder={{ fullName: "Full name", line1: "Address line 1", line2: "Line 2 (optional)", city: "City", region: "State / Region", postalCode: "Postal code", country: "Country", phone: "Phone" }[k]}
                  value={newAddr[k]}
                  onChange={(e) => setNewAddr({ ...newAddr, [k]: e.target.value })}
                />
              ))}
              <button onClick={saveAddress} className="w-full border border-ink bg-ink py-3 text-[11px] uppercase tracking-[0.2em] text-bone hover:bg-ember hover:border-ember">
                Save address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
