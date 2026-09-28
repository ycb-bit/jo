"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { watchProduct, watchProducts } from "@/lib/catalog";
import { ProductImage, imageAt } from "@/components/product-image";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { Magnetic } from "@/components/magnetic";
import { useCart, useWishlist, useToast } from "@/lib/store";
import { track } from "@/lib/analytics";
import { formatMoney, stockFor, totalStock, variantPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProductView({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [imgIdx, setImgIdx] = useState(0);
  const [related, setRelated] = useState<Product[]>([]);
  const cart = useCart();
  const wishlist = useWishlist();
  const { toast } = useToast();

  useEffect(() => watchProduct(slug, setProduct), [slug]);
  useEffect(() => watchProducts(setRelated, { sort: "new" }), []);
  useEffect(() => {
    if (product) track("view_item", { ref: product.id, name: product.name, value: product.price });
  }, [product?.id]);
  useEffect(() => {
    if (product) {
      setColor((c) => c || product.colors[0] || "");
      setSize((s) => s || product.sizes[0] || "");
    }
  }, [product]);

  const variants = useMemo(() => {
    if (!product) return { inStock: false, left: 0, sizeStock: {} as Record<string, number> };
    const sizeStock: Record<string, number> = {};
    product.sizes.forEach((s) => {
      sizeStock[s] = product.colors.reduce((acc, c) => acc + stockFor(product.stock || {}, c, s), 0);
    });
    const left = stockFor(product.stock || {}, color, size);
    return { inStock: left > 0, left, sizeStock };
  }, [product, color, size]);

  if (product === undefined) {
    return (
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 md:grid-cols-2 md:px-10">
        <div className="skeleton aspect-[4/5]" />
        <div className="space-y-5 py-6">
          <div className="skeleton h-12 w-3/4" />
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-32 text-center md:px-10">
        <h1 className="font-display text-5xl uppercase">Piece not found</h1>
        <p className="mt-4 opacity-60">It may have sold out and been retired.</p>
        <Link href="/shop" className="u-link mt-8 inline-block text-[12px] uppercase tracking-[0.2em]">
          ← Back to the rack
        </Link>
      </div>
    );
  }

  const stock = totalStock(product.stock || {});
  const saved = wishlist.productIds.includes(product.id);
  const relatedOthers = related.filter((r) => r.id !== product.id && r.published).slice(0, 4);

  const addToBag = () => {
    if (!variants.inStock) {
      toast("That size just sold out — pick another", "err");
      return;
    }
    cart.add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] || "",
      color,
      size,
      unitPrice: variantPrice(product, color, size),
    });
    track("add_to_cart", { ref: product.id, name: product.name, value: variantPrice(product, color, size), qty: 1 });
    toast(`${product.name} — ${color}/${size} added to your bag`);
  };

  const hasPhotos = (product.images?.length || 0) > 0;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 md:px-10">
      <nav className="mb-8 text-[11px] uppercase tracking-[0.2em] opacity-50">
        <Link href="/shop" className="u-link">Shop</Link> / {product.category}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/5] overflow-hidden bg-bone-dim">
            <AnimatePresence mode="wait">
              <motion.div
                key={imgIdx}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {hasPhotos ? (
                  <ProductImage
                    src={imageAt(product.images, imgIdx)}
                    seed={product.slug}
                    variant={imgIdx}
                    label={`No. ${imgIdx + 1}`}
                    alt={`${product.name} — view ${imgIdx + 1}`}
                    className="h-full w-full object-cover"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    priority={imgIdx === 0}
                  />
                ) : (
                  <ProductImage
                    src={undefined}
                    seed={product.slug}
                    variant={imgIdx}
                    label={`No. ${imgIdx + 1}`}
                    alt={product.name}
                    className="h-full w-full"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {stock === 0 && (
              <span className="absolute left-4 top-4 bg-ink px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-bone">
                Sold out
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-3">
            {Array.from({ length: Math.max(product.images?.length || 0, 3) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                aria-label={`View image ${i + 1} of ${product.name}`}
                className={cn(
                  "relative h-20 w-16 overflow-hidden border transition-all",
                  imgIdx === i ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <ProductImage
                  src={imageAt(product.images, i)}
                  seed={product.slug}
                  variant={i}
                  alt={hasPhotos ? "" : `${product.name} swatch ${i + 1}`}
                  className="h-full w-full object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Buy panel */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="font-display text-4xl uppercase leading-[0.95] md:text-5xl">{product.name}</h1>
            <p className="mt-4 text-xl tabular-nums">{formatMoney(variantPrice(product, color, size), product.currency)}</p>

            <p className="mt-6 max-w-md text-[15px] leading-relaxed opacity-75">{product.description}</p>

            {/* Color */}
            <div className="mt-8">
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Colour — <span className="text-ink">{color}</span></p>
              <div className="mt-3 flex gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "border px-4 py-2 text-[12px] uppercase tracking-[0.12em] transition-all",
                      color === c ? "border-ink bg-ink text-bone" : "border-line hover:border-ink"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">Size</p>
                <p className="text-[11px] uppercase tracking-[0.14em]">
                  {variants.inStock ? (
                    variants.left <= 3 ? (
                      <span className="text-ember">Only {variants.left} left in {size}</span>
                    ) : (
                      <span className="opacity-50">In stock</span>
                    )
                  ) : (
                    <span className="text-ember">Selected size sold out</span>
                  )}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const ss = variants.sizeStock[s] || 0;
                  return (
                    <button
                      key={s}
                      disabled={ss === 0}
                      onClick={() => setSize(s)}
                      className={cn(
                        "min-w-[52px] border px-3 py-2.5 text-[13px] transition-all",
                        size === s ? "border-ink bg-ink text-bone" : "border-line hover:border-ink",
                        ss === 0 && "cursor-not-allowed line-through opacity-30 hover:border-line"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-9 flex items-stretch gap-3">
              <Magnetic>
                <button
                  onClick={addToBag}
                  disabled={stock === 0}
                  className="border border-ink bg-ink px-12 py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors duration-300 hover:border-ember hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {stock === 0 ? "Sold out" : "Add to bag"}
                </button>
              </Magnetic>
              <button
                onClick={() => {
                  wishlist.toggle(product.id);
                  toast(saved ? "Removed from saved" : "Saved for later");
                }}
                className="flex items-center gap-2 border border-line px-5 text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-ink"
                aria-label="Save"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? "#C8501E" : "none"} stroke={saved ? "#C8501E" : "#141311"} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {saved ? "Saved" : "Save"}
              </button>
            </div>

            <p className="mt-5 text-[12px] leading-relaxed opacity-55">
              Paid by bank transfer through Jo&apos;s payment link. Every payment is checked by a
              human before your piece ships — usually within hours.
            </p>

            {/* Details accordion */}
            <div className="mt-10 border-t border-line">
              {[
                ["Fabric", product.fabric],
                ["Care", product.care],
                ["Shipping", `Worldwide flat-rate. Free over ${formatMoney(FREE_SHIPPING_THRESHOLD)}. Dispatched within 2 working days of payment verification.`],
              ].map(([t, d]) => (
                <details key={t} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[12px] uppercase tracking-[0.2em]">
                    {t}
                    <span className="transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-5 text-[14px] leading-relaxed opacity-70">{d}</p>
                </details>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Related */}
      {relatedOthers.length > 0 && (
        <section className="mt-28">
          <Reveal>
            <h2 className="font-display text-3xl uppercase md:text-5xl">Wears well with</h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-7">
            {relatedOthers.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
