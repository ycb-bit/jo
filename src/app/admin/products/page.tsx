"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { useToast } from "@/lib/store";
import { arrayUnion, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { compressImageToDataUri } from "@/lib/image-compress";
import { formatMoney, totalStock, cn, slugify } from "@/lib/utils";
import { CURRENCY } from "@/lib/theme";
import { UploadBox } from "@/components/upload-box";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  category: "", colors: "Bone, Ink", sizes: ["S", "M", "L", "XL"],
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
  const [newCatMode, setNewCatMode] = useState(false); // typing a category that isn't listed yet

  // Firestore hard-limits a document to 1 MiB. Images live inside the product
  // doc, so the set has to fit under that with room for the product fields.
  const FIRESTORE_DOC_LIMIT = 1_000_000;
  const IMAGE_BUDGET = 700_000;
  // Base64 is plain ASCII, so the string length is what Firestore charges
  // against its 1 MiB document limit — measure characters, not decoded bytes.
  const bytesOf = (uri: string) => uri.length;
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

  // The editor is an overlay: Escape closes it and the page behind it stops
  // scrolling, so a long form never drags the product list around.
  const editing = !!draft;
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [editing]);

  const pickImages = async (files: File[]) => {
    const uris: string[] = [];
    // Budget-aware: Firestore docs cap at 1 MiB, so squeeze harder
    // (then smaller) until the whole set fits.
    const budget = IMAGE_BUDGET;
    let used = [...existing, ...images].reduce((n, x) => n + bytesOf(x), 0);
    for (const f of files) {
      try {
        let u = await compressImageToDataUri(f);
        if (used + bytesOf(u) > budget) {
          u = await compressImageToDataUri(f, 900, 0.6);
        }
        if (used + bytesOf(u) > budget) {
          u = await compressImageToDataUri(f, 720, 0.5);
        }
        if (used + bytesOf(u) > budget) {
          toast("Too many photos for one product — kept the ones that fit", "err");
          break;
        }
        used += bytesOf(u);
        uris.push(u);
      } catch {
        toast("Couldn't read one of the images", "err");
      }
    }
    if (uris.length) setImages((xs) => [...xs, ...uris].slice(0, 6));
  };

  const startNew = () => {
    // Start from a category the store actually uses — the old hardcoded
    // default could save a piece into a category the shop never lists.
    setDraft({ ...EMPTY_DRAFT, category: categories[0] || "", stock: {} });
    setImages([]);
    setExisting([]);
    setNewCatMode(false);
  };
  const startEdit = (p: Product) => {
    setImages([]);
    setExisting(p.images || []);
    setNewCatMode(false);
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
    if (!draft.category.trim()) {
      toast("Pick a category for this piece", "err");
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
        category: draft.category.trim(),
        colors,
        sizes: draft.sizes,
        stock,
        published: draft.published,
      }));
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      // A category typed in the editor becomes a first-class shop category, so
      // it is still there (and shiftable) on the next product.
      const savedCategory = draft.category.trim();
      if (savedCategory && !categories.some((c) => c.toLowerCase() === savedCategory.toLowerCase())) {
        await setDoc(
          doc(db, "settings", "store"),
          { categories: arrayUnion(savedCategory) },
          { merge: true }
        ).catch(() => {});
      }
      const live = draft.published;
      toast(
        draft.id
          ? live ? "Product updated — live in the shop" : "Product updated — still a draft, hidden from the shop"
          : live
            ? "Product created — it's live in the shop"
            : "Product created as a draft — tick “Published” to show it in the shop",
        live ? "ok" : "err"
      );
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

  /** Live total for the whole grid, so a low or empty piece is obvious while editing. */
  const draftTotal = useMemo(
    () => Object.values(draft?.stock || {}).reduce((n, v) => n + (parseInt(v, 10) || 0), 0),
    [draft?.stock]
  );

  // Listed categories, plus the piece's own value so editing an older product
  // never shows a blank dropdown.
  const categoryOptions = useMemo(() => {
    const list = [...categories];
    const current = draft?.category.trim();
    if (current && !list.includes(current)) list.push(current);
    return list;
  }, [categories, draft?.category]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl uppercase">Products</h1>
          <p className="mt-1 text-[13px] opacity-60">
            {products.length} in catalog · {products.filter((p) => p.published).length} live ·{" "}
            {products.filter((p) => !p.published).length} draft (hidden from the shop)
          </p>
        </div>
        <button onClick={startNew} className="border border-bone bg-bone px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-ink hover:opacity-90">
          + New product
        </button>
      </div>

      <ul className="mt-8 divide-y divide-bone/10 border-y border-bone/10">
        {products.map((p) => {
          const stock = totalStock(p.stock || {});
          return (
          <li
            key={p.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${p.name}`}
            onClick={() => startEdit(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startEdit(p);
              }
            }}
            className="-mx-2 cursor-pointer px-2 py-4 transition-colors hover:bg-bone/[0.04] focus-visible:bg-bone/[0.04] focus-visible:outline-none"
          >
            {/* Name on the left, price pinned right, actions on their own row.
                The whole row opens the editor — pressing a piece is the obvious
                gesture, and its buttons still work underneath. */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{p.name}</p>
                <p className="text-[11px] opacity-50">
                  {p.category || "no category"} ·{" "}
                  {/* Always name the count — "low stock" alone doesn't say how low. */}
                  <span className={cn(stock === 0 ? "text-red-400" : stock <= 5 ? "text-ember" : "")}>
                    {stock === 0 ? "sold out" : stock <= 5 ? `only ${stock} left` : `${stock} in stock`}
                  </span>{" "}
                  · /{p.slug}
                </p>
              </div>
              <p className="shrink-0 whitespace-nowrap text-right text-[14px] tabular-nums">
                {formatMoney(p.price, p.currency)}
              </p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.14em]">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // the row below opens the editor
                  void togglePublish(p);
                }}
                className={cn("u-link", p.published ? "text-ember" : "opacity-50")}
              >
                {p.published ? "Live" : "Draft — not in the shop"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(p);
                }}
                className="u-link opacity-70 hover:opacity-100"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(p);
                }}
                className="u-link opacity-40 hover:opacity-90 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </li>
          );
        })}
        {products.length === 0 && (
          <li className="py-14 text-center text-[13px] opacity-50">
            No products yet — hit “New product” or run the seed script.
          </li>
        )}
      </ul>

      {/* Editor — an overlay on top of the list, not a panel beside it */}
      {draft && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm md:p-8"
          onClick={() => setDraft(null)}
          role="dialog"
          aria-modal="true"
          aria-label={draft.id ? "Edit product" : "New product"}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-bone/20 bg-ink p-6 shadow-2xl md:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-bone/15 pb-4">
              <div>
                <h2 className="font-display text-2xl uppercase">{draft.id ? "Edit product" : "New product"}</h2>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] opacity-45">
                  {draft.id ? draft.name || "Untitled piece" : "Not in the shop until saved"}
                </p>
              </div>
              <button
                onClick={() => setDraft(null)}
                className="shrink-0 text-[11px] uppercase tracking-[0.14em] opacity-50 hover:opacity-100"
                aria-label="Close editor"
              >
                Close
              </button>
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
                <div className="block">
                  <span className="opacity-60">Category *</span>
                  {newCatMode ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        autoFocus
                        className="w-full border-b border-bone/25 bg-transparent py-2 outline-none placeholder:text-bone/30 focus:border-bone"
                        placeholder="e.g. shirting"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setNewCatMode(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setNewCatMode(false)}
                        className="shrink-0 text-[10px] uppercase tracking-[0.14em] opacity-50 hover:opacity-100"
                      >
                        List
                      </button>
                    </div>
                  ) : (
                    <select
                      className="mt-1 w-full border-b border-bone/25 bg-transparent py-2 outline-none focus:border-bone"
                      value={draft.category}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setNewCatMode(true);
                          setDraft({ ...draft, category: "" });
                        } else {
                          setDraft({ ...draft, category: e.target.value });
                        }
                      }}
                    >
                      {!draft.category && <option value="" className="bg-ink">Pick a category…</option>}
                      {categoryOptions.map((c) => <option key={c} value={c} className="bg-ink">{c}</option>)}
                      <option value="__new__" className="bg-ink">＋ New category…</option>
                    </select>
                  )}
                  <span className="mt-1 block text-[11px] opacity-40">
                    A new one you type here shows up in the shop filter too.
                  </span>
                </div>
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
                <div className="flex items-baseline justify-between gap-3">
                  <span className="opacity-60">Stock per colour / size</span>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      draftTotal === 0 ? "text-red-400" : draftTotal <= 5 ? "text-ember" : "opacity-50"
                    )}
                  >
                    {draftTotal === 0
                      ? "nothing in stock yet"
                      : draftTotal <= 5
                        ? `only ${draftTotal} left in total`
                        : `${draftTotal} in stock`}
                  </span>
                </div>
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
                <UploadBox
                  dark
                  multiple
                  className="mt-2"
                  label="Drop photos here or click to browse"
                  hint="JPG / PNG / HEIC — up to 6, auto-squeezed to fit Firestore"
                  onFiles={async (files) => {
                    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, 6);
                    if (images.length) await pickImages(images);
                  }}
                />

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
                <span className="text-[11px] leading-relaxed opacity-55">
                  {draft.published
                    ? "Will appear in the shop and on the product page."
                    : "Draft — hidden from the shop until you tick Published."}
                </span>
              </div>

              <button onClick={save} disabled={busy} className="w-full bg-ember py-3.5 text-[11px] uppercase tracking-[0.2em] text-bone hover:opacity-90 disabled:opacity-50">
                {busy ? "Saving…" : draft.id ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — details first, then a plain confirm button. */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this product?"
        intro={
          pendingDelete ? (
            <>
              <strong className="font-medium">{pendingDelete.name}</strong> will be removed from
              the shop immediately. This cannot be undone.
            </>
          ) : null
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        busy={busy}
      >
        {pendingDelete && (
          <>
            <dl className="mt-5 space-y-1.5 border-y border-bone/10 py-4 text-[12px]">
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Price</dt>
                <dd className="tabular-nums">{formatMoney(pendingDelete.price, pendingDelete.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-55">Stock on hand</dt>
                <dd className="tabular-nums">{totalStock(pendingDelete.stock || {})} </dd>
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
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
