"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { doc, onSnapshot } from "firebase/firestore";
import type { PaymentMethod, StoreSettings } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

const DEFAULTS: StoreSettings = {
  currency: "ETB",
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
  /** Which payment-method change is waiting for a yes. */
  const [methodConfirm, setMethodConfirm] = useState<
    { kind: "add" } | { kind: "remove"; id: string; name: string } | null
  >(null);

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

  /**
   * Categories save the moment they are added or removed. Keeping them behind
   * the "Save settings" button further down the page is what made a new
   * category look like it never stuck — and there is no cap on how many the
   * shop can carry.
   *
   * Only `categories` is sent: the request must never carry the other fields
   * still open in this form, or an unsaved edit to a payment method would be
   * written (or reverted) as a side effect of adding a category.
   */
  const saveCategories = async (categories: string[], message: string) => {
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings: { categories } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      toast(message);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () => {
    if (!settings) return;
    const value = newCat.trim();
    if (!value) return;
    if (settings.categories.some((c) => c.toLowerCase() === value.toLowerCase())) {
      toast(`“${value}” is already in the list`, "err");
      setNewCat("");
      return;
    }
    const next: StoreSettings = { ...settings, categories: [...settings.categories, value] };
    setSettings(next);
    setNewCat("");
    void saveCategories(next.categories, `Added “${value}” — it's live in the shop filter`);
  };

  const removeCategory = (name: string) => {
    if (!settings) return;
    const categories = settings.categories.filter((c) => c !== name);
    setSettings({ ...settings, categories });
    void saveCategories(categories, `Removed “${name}” — pieces keep theirs`);
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
            onClick={() => setMethodConfirm({ kind: "add" })}
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
                  <button onClick={() => setMethodConfirm({ kind: "remove", id: m.id, name: m.name || `Method ${idx + 1}` })} className="text-ember opacity-80 hover:opacity-100">Remove</button>
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
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl uppercase">Categories</h2>
          <span className="text-[11px] uppercase tracking-[0.16em] opacity-50">
            {settings.categories.length} {settings.categories.length === 1 ? "category" : "categories"}
          </span>
        </div>
        <p className="mt-1 text-[12px] opacity-50">
          The filter list on the shop page — add as many as you need. Each one saves the moment you add it.
          Removing one never touches products: pieces keep their category, and it still appears in the shop
          filter because the products use it.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {settings.categories.map((c, idx) => (
            <span key={`${c}-${idx}`} className="flex items-center gap-2 border border-bone/25 py-1.5 pl-3.5 pr-2 text-[11px] uppercase tracking-[0.16em]">
              {c}
              <button
                onClick={() => removeCategory(c)}
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
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <button
            onClick={addCategory}
            disabled={busy || !newCat.trim()}
            className="border border-bone/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] hover:border-bone disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* General */}
      <div className="mt-10 space-y-5 text-[13px]">
        <h2 className="font-display text-xl uppercase">General</h2>
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

      <ConfirmDialog
        open={methodConfirm !== null}
        title={methodConfirm?.kind === "remove" ? "Remove this payment method?" : "Add a payment method?"}
        intro={
          methodConfirm?.kind === "remove"
            ? `Checkout will stop offering “${methodConfirm.name}”. Orders already placed keep their record — nothing else changes.`
            : "A blank method appears below for you to fill in. Nothing goes live at checkout until you save settings."
        }
        confirmLabel={methodConfirm?.kind === "remove" ? "Remove method" : "Add method"}
        onCancel={() => setMethodConfirm(null)}
        onConfirm={() => {
          if (!settings || !methodConfirm) return;
          if (methodConfirm.kind === "add") {
            setSettings({ ...settings, paymentMethods: [...settings.paymentMethods, newMethod()] });
          } else {
            removeMethod(methodConfirm.id);
          }
          setMethodConfirm(null);
        }}
      />

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
