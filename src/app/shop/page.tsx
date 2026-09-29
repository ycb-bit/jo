"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { watchProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { cn } from "@/lib/utils";
import type { Product, StoreSettings } from "@/lib/types";

const DEFAULT_CATEGORIES = ["outerwear", "knitwear", "tops", "bottoms", "accessories"];
const SORTS = [
  ["new", "Newest"],
  ["price-asc", "Price ↑"],
  ["price-desc", "Price ↓"],
] as const;

function ShopInner() {
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get("category") || "all";
  const [products, setProducts] = useState<Product[] | null>(null);
  const [sort, setSort] = useState<string>("new");
  const [maxPrice, setMaxPrice] = useState(0);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Admin-managed categories (Admin → Settings → Categories)
    return onSnapshot(
      doc(db, "settings", "store"),
      (snap) => {
        const d = snap.data() as Partial<StoreSettings> | undefined;
        const cats = (d?.categories || []).filter(Boolean);
        setCategories(cats.length ? cats : DEFAULT_CATEGORIES);
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    setLoadError(null);
    return watchProducts(
      setProducts,
      {
        category: category === "all" ? undefined : category,
        sort,
      },
      () => setLoadError("The rack could not be loaded. Please refresh in a moment.")
    );
  }, [category, sort]);

  const priceCeil = useMemo(() => {
    if (!products) return 0;
    return Math.max(...products.map((p) => p.price), 100);
  }, [products]);

  const visible = useMemo(() => {
    if (!products) return [];
    return maxPrice > 0 ? products.filter((p) => p.price <= maxPrice) : products;
  }, [products, maxPrice]);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <Reveal>
        <h1 className="font-display text-[13vw] font-black uppercase leading-[0.85] md:text-[7vw]">
          The rack<span className="text-ember">.</span>
        </h1>
      </Reveal>

      <div className="sticky top-[57px] z-30 -mx-5 mt-8 border-y border-line bg-bone/90 px-5 py-3.5 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Category dropdown — native select (the triangle one), admin-managed list */}
            <label className="relative flex items-center">
              <span className="mr-3 text-[11px] uppercase tracking-[0.16em] opacity-60">Category</span>
              <select
                value={category}
                onChange={(e) => router.push(e.target.value === "all" ? "/shop" : `/shop?category=${e.target.value}`)}
                className="appearance-none border border-ink bg-transparent py-1.5 pl-3.5 pr-9 text-[11px] uppercase tracking-[0.16em] outline-none"
              >
                <option value="all">All pieces</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none absolute right-3 text-[9px] opacity-70">▼</span>
            </label>
          </div>
          <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.16em]">
            <label className="flex items-center gap-2 opacity-80">
              Max
              <input
                type="range"
                min={0}
                max={priceCeil || 5000}
                step={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="h-1 w-28 accent-ember"
              />
              {maxPrice > 0 ? `${maxPrice.toLocaleString()} Br` : "any"}
            </label>
            <div className="flex gap-1">
              {SORTS.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  className={cn("px-2 py-1 transition-colors", sort === v ? "text-ember" : "opacity-50 hover:opacity-100")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-[0.2em] opacity-50">
        {products ? `${visible.length} piece${visible.length === 1 ? "" : "s"}` : "Loading"}
      </p>

      {loadError ? (
        <div className="mt-20 border border-ember/40 p-16 text-center">
          <p className="font-display text-3xl uppercase">Rack unavailable</p>
          <p className="mt-3 opacity-60">{loadError}</p>
          <button
            onClick={() => router.refresh()}
            className="mt-6 border border-ink px-6 py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-ink hover:text-bone"
          >
            Try again
          </button>
        </div>
      ) : products === null ? (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-20 border border-line p-16 text-center">
          <p className="font-display text-3xl uppercase">Nothing here yet</p>
          <p className="mt-3 opacity-60">Jo hasn&apos;t hung anything in this corner. Check the full rack.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-7">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1440px] px-5 py-20"><div className="skeleton h-96 w-full" /></div>}>
      <ShopInner />
    </Suspense>
  );
}
