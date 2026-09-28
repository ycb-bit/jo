"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { doc, onSnapshot } from "firebase/firestore";
import type { PaymentMethod, StoreSettings } from "@/lib/types";

const DEFAULTS: StoreSettings = {
  currency: "USD",
  handlingFee: 0,
  paymentMethods: [],
  categories: ["outerwear", "knitwear", "tops", "bottoms", "accessories"],
  announcement: "Free worldwide shipping — hand-finished in small batches",
};

const NUMERIC_KEYS: (keyof StoreSettings)[] = ["handlingFee"];

function newMethod(): PaymentMethod {
  return {
    id: `pm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    type: "bank",
    accountName: "",
    accountNumber: "",
    url: "",
    instructions: "",
  };
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "store"),
      (snap) => setSettings({ ...DEFAULTS, ...(snap.data() || {}) } as StoreSettings),
      () => setSettings(DEFAULTS)
    );
  }, []);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      toast("Settings saved — storefront updates instantly");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const updateMethod = (id: string, patch: Partial<PaymentMethod>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      paymentMethods: settings.paymentMethods.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const removeMethod = (id: string) => {
    if (!settings) return;
    setSettings({ ...settings, paymentMethods: settings.paymentMethods.filter((m) => m.id !== id) });
  };

  const moveMethod = (idx: number, dir: -1 | 1) => {
    if (!settings) return;
    const next = [...settings.paymentMethods];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSettings({ ...settings, paymentMethods: next });
  };

  if (!settings) return <div className="skeleton h-64 w-full" />;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl uppercase">Store settings</h1>
      <p className="mt-1 text-[13px] opacity-60">Payment options and storefront copy. Changes go live immediately.</p>

      {/* Payment methods */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Payment methods</h2>
          <button
            onClick={() => setSettings({ ...settings, paymentMethods: [...settings.paymentMethods, newMethod()] })}
            className="border border-bone/30 px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-bone"
          >
            + Add method
          </button>
        </div>
        <p className="mt-1 text-[12px] opacity-50">
          Banks or payment links customers choose from at checkout. The first one is selected by default.
        </p>

        <div className="mt-5 space-y-4">
          {settings.paymentMethods.map((m, idx) => (
            <div key={m.id} className="border border-bone/15 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.16em] opacity-50">Method {idx + 1}</span>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
                  <button onClick={() => moveMethod(idx, -1)} disabled={idx === 0} className="opacity-60 hover:opacity-100 disabled:opacity-20">↑</button>
                  <button onClick={() => moveMethod(idx, 1)} disabled={idx === settings.paymentMethods.length - 1} className="opacity-60 hover:opacity-100 disabled:opacity-20">↓</button>
                  <button onClick={() => removeMethod(m.id)} className="text-ember opacity-80 hover:opacity-100">Remove</button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
                <label className="block">
                  <span className="opacity-60">Display name</span>
                  <input
                    className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                    placeholder='e.g. "CBE" or "Wise"'
                    value={m.name}
                    onChange={(e) => updateMethod(m.id, { name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="opacity-60">Type</span>
                  <select
                    className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                    value={m.type}
                    onChange={(e) => updateMethod(m.id, { type: e.target.value as PaymentMethod["type"] })}
                  >
                    <option value="bank">Bank transfer</option>
                    <option value="link">Payment link</option>
                  </select>
                </label>
                {m.type === "bank" ? (
                  <>
                    <label className="block">
                      <span className="opacity-60">Account name</span>
                      <input
                        className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                        value={m.accountName || ""}
                        onChange={(e) => updateMethod(m.id, { accountName: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="opacity-60">Account number / IBAN</span>
                      <input
                        className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                        value={m.accountNumber || ""}
                        onChange={(e) => updateMethod(m.id, { accountNumber: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <label className="block sm:col-span-2">
                    <span className="opacity-60">Payment URL</span>
                    <input
                      className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                      placeholder="https://…"
                      value={m.url || ""}
                      onChange={(e) => updateMethod(m.id, { url: e.target.value })}
                    />
                  </label>
                )}
                <label className="block sm:col-span-2">
                  <span className="opacity-60">Instructions (optional)</span>
                  <input
                    className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
                    placeholder="e.g. Use the order reference as the transfer memo"
                    value={m.instructions || ""}
                    onChange={(e) => updateMethod(m.id, { instructions: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
          {settings.paymentMethods.length === 0 && (
            <p className="border border-dashed border-bone/20 p-6 text-center text-[13px] opacity-50">
              No payment methods yet — add a bank or payment link so checkout can offer it.
            </p>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="mt-10">
        <h2 className="font-display text-xl uppercase">Categories</h2>
        <p className="mt-1 text-[12px] opacity-50">
          The filter list on the shop page. Removing one won&apos;t touch products — they just won&apos;t be reachable by that filter until re-added.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {settings.categories.map((c, idx) => (
            <span key={`${c}-${idx}`} className="flex items-center gap-2 border border-bone/25 py-1.5 pl-3.5 pr-2 text-[11px] uppercase tracking-[0.16em]">
              {c}
              <button
                onClick={() => setSettings({ ...settings, categories: settings.categories.filter((_, i) => i !== idx) })}
                className="text-ember opacity-80 hover:opacity-100"
                aria-label={`Remove category ${c}`}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            className="w-40 border-b border-bone/25 bg-transparent py-1.5 text-[12px] outline-none placeholder:text-bone/30 focus:border-bone"
            placeholder="New category…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCat.trim()) {
                e.preventDefault();
                const v = newCat.trim().toLowerCase();
                if (!settings.categories.includes(v)) {
                  setSettings({ ...settings, categories: [...settings.categories, v] });
                }
                setNewCat("");
              }
            }}
          />
          <button
            onClick={() => {
              if (!newCat.trim()) return;
              const v = newCat.trim().toLowerCase();
              if (!settings.categories.includes(v)) {
                setSettings({ ...settings, categories: [...settings.categories, v] });
              }
              setNewCat("");
            }}
            className="border border-bone/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] hover:border-bone"
          >
            + Add
          </button>
        </div>
      </div>

      {/* General */}
      <div className="mt-10 space-y-5 text-[13px]">
        <h2 className="font-display text-xl uppercase">General</h2>
        <label className="block">
          <span className="opacity-60">Currency code (USD, EUR, GBP, ETB…)</span>
          <input
            className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="opacity-60">Handling / packaging fee per order</span>
          <input
            className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
            type="number"
            step="0.01"
            value={String(settings.handlingFee ?? 0)}
            onChange={(e) =>
              setSettings({ ...settings, handlingFee: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="mt-1 block text-[11px] opacity-40">Extra cost added to every order — set 0 to disable</span>
        </label>
        <label className="block">
          <span className="opacity-60">Announcement bar text</span>
          <input
            className="mt-1 w-full border-b border-bone/25 bg-transparent py-2.5 outline-none focus:border-bone"
            value={settings.announcement}
            onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
          />
        </label>
        <button onClick={save} disabled={busy} className="w-full bg-ember py-3.5 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>

      <div className="mt-10 border border-bone/15 p-6 text-[12px] leading-relaxed opacity-60">
        <p className="font-display text-sm uppercase tracking-[0.16em] text-bone">How verification works</p>
        <p className="mt-3">
          At checkout the customer picks a payment method, sees your exact details with their order
          reference, pays, and uploads a receipt photo (compressed automatically — nothing to set up).
          The order lands in your Verification desk with the receipt, the method they chose, and the
          bank reference they typed. Verifying confirms payment and decrements stock automatically.
          Shipping is free storewide — no fees to configure.
        </p>
      </div>
    </div>
  );
}
