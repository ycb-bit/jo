"use client";

import { useEffect, useState } from "react";
import { useWishlist } from "@/lib/store";
import { watchProductById } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { BackButton } from "@/components/back-button";
import { useT } from "@/lib/i18n";
import type { Product } from "@/lib/types";
import Link from "next/link";

export default function WishlistPage() {
  const { t } = useT();
  const productIds = useWishlist((s) => s.productIds);
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const unsubs = productIds.map((id) =>
      watchProductById(id, (p) => {
        setItems((prev) => {
          const rest = prev.filter((x) => x.id !== id);
          return p ? [...rest, p] : rest;
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [productIds]);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      <h1 className="font-display text-5xl uppercase md:text-7xl">
        {t("wish.title")}<span className="text-ember">.</span>
      </h1>
      {productIds.length === 0 ? (
        <div className="mt-8 border border-line p-16 text-center">
          <p className="font-display text-3xl uppercase">{t("wish.emptyTitle")}</p>
          <p className="mt-3 opacity-60">{t("wish.emptyBody")}</p>
          <Link href="/shop" className="u-link mt-6 inline-block text-[12px] uppercase tracking-[0.2em]">
            {t("wish.browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-7">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
