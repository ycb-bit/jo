"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { ProductArt } from "./product-art";
import { useWishlist } from "@/lib/store";
import { formatMoney, totalStock } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const wishlist = useWishlist();
  const [hover, setHover] = useState(false);
  const stock = totalStock(product.stock || {});
  const saved = wishlist.productIds.includes(product.id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-bone-dim">
          <ProductArt
            seed={product.slug}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              hover && product.images?.length === 0 ? "opacity-0" : "opacity-100"
            )}
          />
          <ProductArt
            seed={product.slug}
            variant={1}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              hover ? "opacity-100" : "opacity-0"
            )}
          />
          {stock === 0 && (
            <span className="absolute left-3 top-3 bg-ink px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-bone">
              Sold out
            </span>
          )}
          {stock > 0 && stock <= 4 && (
            <span className="absolute left-3 top-3 bg-ember px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-bone">
              {stock} left
            </span>
          )}
          <button
            aria-label="Save"
            onClick={(e) => {
              e.preventDefault();
              wishlist.toggle(product.id);
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-ink/15 bg-bone/80 opacity-0 backdrop-blur transition-all duration-300 hover:bg-bone group-hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? "#C8501E" : "none"} stroke={saved ? "#C8501E" : "#141311"} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <div className="mt-3.5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-medium leading-snug">{product.name}</h3>
            <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] opacity-50">
              {product.category}
            </p>
          </div>
          <p className="text-[15px] tabular-nums">{formatMoney(product.price, product.currency)}</p>
        </div>
      </Link>
    </motion.article>
  );
}
