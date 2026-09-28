"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { compressImageToDataUri } from "@/lib/image-compress";
import { formatMoney, totalStock, cn, slugify } from "@/lib/utils";
import { CURRENCY } from "@/lib/theme";
import type { Product } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const FALLBACK_CATEGORIES = ["outerwear", "knitwear", "tops", "bottoms", "accessories"];

type Draft = {
  id?: string;
  name: string;
  description: string;
  fabric: string;
  care: string;
  price: string;
  priceOverrides: Record<string, string>;
  category: string;
  colors: string;
  sizes: string[];
  stock: Record<string, string>;
  published: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "", description: "", fabric: "", care: "", price: "", priceOverrides: {},
  category: "outerwear", colors: "Bone, Ink", sizes: ["S", "M", "L", "XL"],
  stock: {}, published: true,
};

export default function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [images, setImages] = useState<string[]>([]); // newly picked, compressed data URIs
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [existing, setExisting] = useState<string[]>([]); // images already on the product
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Firestore hard-limits a document to 1 MiB. Images live inside the product
  // doc, so the set has to fit under that with room for the product fields.
  const FIRESTORE_DOC_LIMIT = 1_000_000;
  const IMAGE_BUDGET = 700_000;
  const bytesOf = (uri: string) => Math.ceil((uri.length * 3) / 4);
  const imageBytes = useMemo(
    () => [...existing, ...images].reduce((n, u) => n + bytesOf(u), 0),
    [existing, images]
  );
  const budgetPct = Math.min(100, Math.round((imageBytes / IMAGE_BUDGET) * 100));

  useEffect(() => {
    return onSnapshot(collection(db, "products"), (s) =>
      setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[])
    );
  }, []);

  useEffect(() => {
    // Admin-managed category list (Admin → Settings → Categories)
    return onSnapshot(
      doc(db, "settings", "store"),
      (snap) => {
        const cats = ((snap.data() as { categories?: string[] } | undefined)?.categories || []).filter(Boolean);
        setCategories(cats.length ? cats : FALLBACK_CATEGORIES);
      },
      () => {}
    );
  }, []);

  const pickImages = async (files: File[]) => {
    const uris: string[] = [];
    // Budget-aware: Firestore docs cap at 1 MiB, so squeeze harder
    // (then smaller) until the whole set fits.
    const budget = 700_000;
    let used = images.reduce((n, x) => n + x.length, 0);
    for (const f of files) {
      try {
        let u = await compressImageToDataUri(f);
        if (used + u.length > budget) {
          u = await compressImageToDataUri(f, 720, 0.5);
        }
        if (used + u.length > budget) {
          toast("Too many photos for one product — kept the ones that fit", "err");
          break;
        }
        used += u.length;
        uris.push(u);
      } catch {
        toast("Couldn't read one of the images", "err");
      }
    }
    if (uris.length) setImages((xs) => [...xs, ...uris].slice(0, 6));
  };

  const startNew = () => {
    setDraft({ ...EMPTY_DRAFT, stock: {} });
    setImages([]);
    setExisting([]);
  };
  const startEdit = (p: Product) => {
    setImages([]);
    setExisting(p.images || []);
    setDraft({
      id: p.id, name: p.name, description: p.description, fabric: p.fabric, care: p.care,
      price: String(p.price),
      priceOverrides: Object.fromEntries(
        Object.entries(p.priceOverrides || {}).map(([k, v]) => [k, String(v)])
      ),
      category: p.category, colors: (p.colors || []).join(", "),
      sizes: p.sizes?.length ? p.sizes : ["S", "M", "L"],
      stock: Object.fromEntries(Object.entries(p.stock || {}).map(([k, v]) => [k, String(v)])),
      published: p.published,
    });
  };

  const togglePublish = async (p: Product) => {
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/admin/products", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "togglePublish", id: p.id, published: !p.published }),
    });
  };

  const remove = async (p: Product) => {
    const token = await auth.currentUser?.getIdToken();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delete", id: p.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Delete failed");
      toast(`"${p.name}" deleted`);
      if (draft?.id === p.id) setDraft(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "err");
    } finally {
      setBusy(false);
      setPendingDelete(null);
      setDeleteConfirmText("");
    }
  };

  /** Reorder the combined (existing + newly picked) image list. Index 0 is the cover. */
  const moveImage = (index: number, dir: -1 | 1) => {
    const all = [...existing, ...images];
    const target = index + dir;
    if (target < 0 || target >= all.length) return;
    const next = [...all];
    [next[index], next[target]] = [next[target], next[index]];
    const split = existing.length;
    setExisting(next.slice(0, split));
    setImages(next.slice(split));
  };

  const removeImageAt = (index: number) => {
    const all = [...existing, ...images];
    all.splice(index, 1);
    const split = existing.length;
    setExisting(all.slice(0, split));
    setImages(all.slice(split));
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name || !draft.price) {
      toast("Name and price are required", "err");
      return;
    }
    setBusy(true);
    try {
      const colors = draft.colors.split(",").map((c) => c.trim()).filter(Boolean);
      const stock: Record<string, number> = {};
      draft.sizes.forEach((s) => {
        colors.forEach((c) => {
          const k = `${c}|${s}`;
          stock[k] = parseInt(draft.stock[k] || "0", 10) || 0;
        });
      });
      const priceOverrides: Record<string, number> = {};
      for (const [k, v] of Object.entries(draft.priceOverrides)) {
        const n = parseFloat(v);
        if (!Number.isNaN(n) && n > 0) priceOverrides[k] = n;
      }
      const token = await auth.currentUser?.getIdToken();
      const form = new FormData();
      form.append("imagesSet", "1"); // explicit: this save defines the full image set
      existing.forEach((u) => form.append("images", u));
      images.forEach((uri) => form.append("images", uri));
      form.append("payload", JSON.stringify({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        slug: draft.id ? undefined : slugify(draft.name),
        description: draft.description,
        fabric: draft.fabric,
        care: draft.care,
        price: parseFloat(draft.price) || 0,
        ...(Object.keys(priceOverrides).length ? { priceOverrides } : {}),
        currency: CURRENCY,
        category: draft.category,
        colors,
        sizes: draft.sizes,
        stock,
        published: draft.published,
      }));
      images.forEach((uri) => form.append("images", uri));
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast(draft.id ? "Product updated" : "Product created — it's live");
      setDraft(null);
      setImages([]);
      setExisting([]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const setStockCell = (c: string, s: string, v: string) =>
    setDraft((d) => (d ? { ...d, stock: { ...d.stock, [`${c}|${s}`]: v } } : d));

  const colors = useMemo(
    () => (draft?.colors || "").split(",").map((c) => c.trim()).filter(Boolean),
    [draft?.colors]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase">Products</h1>
          <p className="mt-1 text-[13px] opacity-60">{products.length} in catalog · {products.filter((p) => p.published).length} live</p>
        </div>
        <button onClick={startNew} className="border border-bone bg-bone px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-ink hover:opacity-90">
          + New product
        </button>
      </div>

      <ul className="mt-8 divide-y divide-bone/10 border-y border-bone/10">
        {products.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-[14px] font-medium">
                {p.name}
              </p>
              <p className="text-[11px] opacity-50">
                {p.category} · {formatMoney(p.price, p.currency)} · {totalStock(p.stock || {})} in stock · /{p.slug}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-[11px] uppercase tracking-[0.14em]">
              <button onClick={() => togglePublish(p)} className={cn("u-link", p.published ? "text-ember" : "opacity-50")}>
                {p.published ? "Live" : "Draft"}
              </button>
              <button onClick={() => startEdit(p)} className="u-link opacity-70 hover:opacity-100">Edit</button>
              <button onClick={() => { setPendingDelete(p); setDeleteConfirmText(""); }} className="u-link opacity-40 hover:opacity-90 hover:text-red-400">Delete</button>
            </div>
          </li>
        ))}
        {products.length === 0 && (
          <li className="py-14 text-center text-[13px] opacity-50">
            No products yet — hit “New product” or run the seed script.
          </li>
        )}
      </ul>

      {/* Editor drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/70 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-bone/15 bg-ink p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl uppercase">{draft.id ? "Edit product" : "New product"}</h2>
              <button onClick={() => setDraft(null)} className="text-[11px] uppercase tracking-[0.14em] opacity-50 hover:opacity-100">Close</button>
            </div>

            <div className="mt-6 space-y-4 text-[13px]">
              <label className="block">
                <span className="opacity-60">Name *</span>
                <input className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="opacity-60">Description</span>
                <textarea className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="opacity-60">Price (ETB) *</span>
                  <input type="number" step="1" className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                </label>
                <label className="block">
                  <span className="opacity-60">Category</span>
                  <select className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    {categories.map((c) => <option key={c} value={c} className="bg-ink">{c}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="opacity-60">Fabric</span>
                <input className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.fabric} onChange={(e) => setDraft({ ...draft, fabric: e.target.value })} />
              </label>
              <label className="block">
                <span className="opacity-60">Care</span>
                <input className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.care} onChange={(e) => setDraft({ ...draft, care: e.target.value })} />
              </label>
              <label className="block">
                <span className="opacity-60">Colours (comma separated)</span>
                <input className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone" value={draft.colors} onChange={(e) => setDraft({ ...draft, colors: e.target.value })} />
              </label>
              <div>
                <span className="opacity-60">Sizes</span>
                <div className="mt-2 flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft((d) => d && ({ ...d, sizes: d.sizes.includes(s) ? d.sizes.filter((x) => x !== s) : [...d.sizes, s] }))}
                      className={cn("border px-3 py-1.5", draft.sizes.includes(s) ? "border-bone bg-bone text-ink" : "border-bone/25 opacity-60")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock grid */}
              <div>
                <span className="opacity-60">Stock per colour / size</span>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-center text-[12px]">
                    <thead>
                      <tr>
                        <th></th>
                        {draft.sizes.map((s) => <th key={s} className="px-2 pb-1 font-normal opacity-50">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map((c) => (
                        <tr key={c}>
                          <td className="py-1 pr-2 text-left opacity-70">{c}</td>
                          {draft.sizes.map((s) => (
                            <td key={s} className="px-1 py-1">
                              <input
                                type="number" min={0}
                                className="w-14 border border-bone/25 bg-transparent px-1 py-1 text-center tabular-nums outline-none focus:border-bone"
                                value={draft.stock[`${c}|${s}`] || ""}
                                placeholder="0"
                                onChange={(e) => setStockCell(c, s, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <span className="opacity-60">Images (up to 6 — auto-compressed, no bucket needed)</span>
                <label
                  className="mt-2 flex cursor-pointer flex-col items-center justify-center border border-dashed border-bone/30 p-6 text-center transition-colors hover:border-bone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/")).slice(0, 6);
                    if (files.length) await pickImages(files);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []).slice(0, 6);
                      await pickImages(files);
                      e.target.value = "";
                    }}
                  />
                  <span className="text-[13px] opacity-70">Drop photos here or click to browse</span>
                  <span className="mt-1 text-[11px] opacity-40">
                    JPG / PNG / HEIC — up to 6, auto-squeezed to fit Firestore
                  </span>
                </label>

                {/* Storage budget — images live inside the product document */}
                {imageBytes > 0 && (
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-[11px] opacity-60">
                      <span>
                        {existing.length + images.length} image
                        {existing.length + images.length === 1 ? "" : "s"} ·{" "}
                        {(imageBytes / 1024).toFixed(0)} KB of {(IMAGE_BUDGET / 1024).toFixed(0)} KB budget
                      </span>
                      <span className={budgetPct > 90 ? "text-ember" : ""}>{budgetPct}%</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-bone/10">
                      <div
                        className={cn("h-full transition-all", budgetPct > 90 ? "bg-ember" : "bg-bone/60")}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                    {budgetPct > 90 && (
                      <p className="mt-1.5 text-[11px] text-ember">
                        Close to the Firestore 1 MiB document limit. Remove one before saving.
                      </p>
                    )}
                  </div>
                )}

                {[...existing, ...images].length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] opacity-50">
                      Order — the first image is the cover shown on the shop grid
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {[...existing, ...images].map((u, i) => (
                        <div key={i} className="group/img relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt={`Product image ${i + 1}`}
                            className={cn(
                              "h-24 w-20 object-cover transition-all",
                              i === 0 ? "ring-2 ring-ember" : "opacity-80"
                            )}
                          />
                          {i === 0 && (
                            <span className="absolute left-0 top-0 bg-ember px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-bone">
                              Cover
                            </span>
                          )}
                          {i < existing.length && (
                            <span className="absolute bottom-0 right-0 bg-ink/70 px-1 py-0.5 text-[9px] uppercase tracking-[0.14em] text-bone">
                              Saved
                            </span>
                          )}

                          <div className="absolute -right-1.5 -top-1.5 flex gap-1">
                            <button
                              onClick={() => removeImageAt(i)}
                              className="flex h-5 w-5 items-center justify-center bg-ember text-[10px] leading-none text-bone"
                              aria-label={`Remove image ${i + 1}`}
                            >
                              ✕
                            </button>
                          </div>

                          <div className="absolute inset-x-0 bottom-0 flex justify-between opacity-0 transition-opacity group-hover/img:opacity-100">
                            <button
                              onClick={() => moveImage(i, -1)}
                              disabled={i === 0}
                              className="bg-ink/80 px-1.5 py-0.5 text-[10px] text-bone disabled:opacity-30"
                              aria-label={`Move image ${i + 1} earlier`}
                            >
                              ←
                            </button>
                            <button
                              onClick={() => moveImage(i, 1)}
                              disabled={i === [...existing, ...images].length - 1}
                              className="bg-ink/80 px-1.5 py-0.5 text-[10px] text-bone disabled:opacity-30"
                              aria-label={`Move image ${i + 1} later`}
                            >
                              →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] opacity-45">
                      Hover a photo to reorder. First image = cover on the shop grid and landing page.
                    </p>
                  </div>
                )}
              </div>

              {/* Variant price overrides */}
              <div>
                <span className="opacity-60">Variant prices (optional — blank = base price)</span>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-center text-[12px]">
                    <thead>
                      <tr>
                        <th></th>
                        {draft.sizes.map((s) => <th key={s} className="px-2 pb-1 font-normal opacity-50">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map((c) => (
                        <tr key={c}>
                          <td className="py-1 pr-2 text-left opacity-70">{c}</td>
                          {draft.sizes.map((s) => (
                            <td key={s} className="px-1 py-1">
                              <input
                                type="number" step="0.01" min={0}
                                className="w-16 border border-bone/25 bg-transparent px-1 py-1 text-center tabular-nums outline-none focus:border-bone"
                                value={draft.priceOverrides[`${c}|${s}`] || ""}
                                placeholder="—"
                                onChange={(e) =>
                                  setDraft((d) => (d ? { ...d, priceOverrides: { ...d.priceOverrides, [`${c}|${s}`]: e.target.value } } : d))
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
                  <span className="opacity-80">Published</span>
                </label>
              </div>

              <button onClick={save} disabled={busy} className="w-full bg-ember py-3.5 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:opacity-50">
                {busy ? "Saving…" : draft.id ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — type the product name to confirm */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md border border-bone/20 bg-ink p-7 text-bone">
            <h2 className="font-display text-2xl uppercase">Delete this product?</h2>
            <p className="mt-3 text-[13px] leading-relaxed opacity-75">
              <strong className="font-medium">{pendingDelete.name}</strong> will be removed from
              the shop immediately. This cannot be undone.
            </p>

            <dl className="mt-5 space-y-1.5 border-y border-bone/10 py-4 text-[12px]">
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Price</dt>
                <dd className="tabular-nums">{formatMoney(pendingDelete.price, pendingDelete.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Stock on hand</dt>
                <dd className="tabular-nums">{totalStock(pendingDelete.stock || {})}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Photos</dt>
                <dd className="tabular-nums">{pendingDelete.images?.length || 0}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Status</dt>
                <dd>{pendingDelete.published ? "Live on the site" : "Draft"}</dd>
              </div>
            </dl>

            <p className="mt-4 text-[12px] leading-relaxed opacity-60">
              Past orders keep their own copy of the name, price and options, so order history
              and receipts stay correct.
            </p>

            <label className="mt-5 block text-[11px] uppercase tracking-[0.18em] opacity-60">
              Type <span className="text-bone">{pendingDelete.name}</span> to confirm
            </label>
            <input
              className="input mt-2"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setPendingDelete(null); setDeleteConfirmText(""); }}
                className="flex-1 border border-bone/30 px-4 py-3 text-[11px] uppercase tracking-[0.2em] opacity-70 hover:opacity-100"
              >
                Keep it
              </button>
              <button
                onClick={() => remove(pendingDelete)}
                disabled={busy || deleteConfirmText.trim() !== pendingDelete.name.trim()}
                className="flex-1 bg-ember px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
