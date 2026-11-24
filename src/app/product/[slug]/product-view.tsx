"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { watchProduct, watchProducts } from "@/lib/catalog";
import { ProductImage, imageAt } from "@/components/product-image";
import { FadeIn } from "@/components/fade-in";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { Magnetic } from "@/components/magnetic";
import { useCart, useWishlist, useToast } from "@/lib/store";
import { track } from "@/lib/analytics";
import { formatMoney, stockFor, totalStock, variantPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { BackButton } from "@/components/back-button";

export default function ProductView({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [imgIdx, setImgIdx] = useState(0);
  const [related, setRelated] = useState<Product[]>([]);
  /** What was just bagged, shown inline next to the button (a bottom toast is easy to miss). */
  const [bagged, setBagged] = useState<string | null>(null);
  const cart = useCart();
  const wishlist = useWishlist();
  const { toast } = useToast();
  const { t } = useT();

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
        <h1 className="font-display text-5xl uppercase">{t("product.notFound")}</h1>
        <p className="mt-4 opacity-60">{t("product.notFoundBody")}</p>
        <Link href="/shop" className="u-link mt-8 inline-block text-[12px] uppercase tracking-[0.2em]">
          {t("product.backToRack")}
        </Link>
      </div>
    );
  }

  const stock = totalStock(product.stock || {});
  const saved = wishlist.productIds.includes(product.id);
  const relatedOthers = related.filter((r) => r.id !== product.id && r.published).slice(0, 4);

  const addToBag = () => {
    if (!variants.inStock) {
      toast(t("toast.sizeSoldOut"), "err");
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
    toast(t("toast.addedToBag", { name: product.name, variant: `${color}/${size}` }));
    setBagged(`${product.name} — ${color}/${size}`);
    setTimeout(() => setBagged(null), 6000);
  };

  const hasPhotos = (product.images?.length || 0) > 0;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 md:px-10">
      <BackButton />
      <nav className="mb-8 text-[11px] uppercase tracking-[0.2em] opacity-50">
        <Link href="/shop" className="u-link">{t("nav.shop")}</Link> / {product.category}
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
                {t("product.soldOut")}
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
          <FadeIn animate={false} y={24} duration={0.7}>
            <h1 className="font-display text-4xl uppercase leading-[0.95] md:text-5xl">{product.name}</h1>
            <p className="mt-4 text-xl tabular-nums">{formatMoney(variantPrice(product, color, size), product.currency)}</p>

            <p className="mt-6 max-w-md text-[15px] leading-relaxed opacity-75">{product.description}</p>

            {/* Color */}
            <div className="mt-8">
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("product.colour")} — <span className="text-ink">{color}</span></p>
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
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{t("product.size")}</p>
                <p className="text-[11px] uppercase tracking-[0.14em]">
                  {variants.inStock ? (
                    variants.left <= 5 ? (
                      <span className="text-ember">
                        {t("product.onlyLeft", { n: variants.left, size })}
                      </span>
                    ) : (
                      <span className="opacity-50">{t("product.inStock")}</span>
                    )
                  ) : (
                    <span className="text-ember">{t("product.sizeSoldOut")}</span>
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
                  {stock === 0 ? t("product.soldOut") : t("product.addToBag")}
                </button>
              </Magnetic>
              {bagged && (
                <div className="mt-4 border border-ink bg-bone-dim/60 p-4 text-[13px]">
                  <p>
                    <span className="mr-2" aria-hidden>✓</span>
                    <strong>{bagged.split(" — ")[0]}</strong> {t("product.bagged")} ({bagged.split(" — ")[1]}).
                  </p>
                  <div className="mt-2 flex gap-5 text-[11px] uppercase tracking-[0.16em]">
                    <Link href="/cart" className="u-link text-ember">{t("product.viewBag")}</Link>
                    <Link href="/checkout" className="u-link">{t("product.checkoutNow")}</Link>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  wishlist.toggle(product.id);
                  toast(t(saved ? "toast.unsaved" : "toast.saved"));
                }}
                className="flex items-center gap-2 border border-line px-5 text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-ink"
                aria-label="Save"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? "#C8501E" : "none"} stroke={saved ? "#C8501E" : "#141311"} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {saved ? t("product.saved") : t("product.save")}
              </button>
            </div>

            <p className="mt-5 text-[12px] leading-relaxed opacity-55">{t("product.payNote")}</p>

            {/* Details accordion */}
            <div className="mt-10 border-t border-line">
              {[
                [t("product.fabric"), product.fabric],
                [t("product.care"), product.care],
                [t("product.shipping"), t("product.shippingBody", { amount: formatMoney(FREE_SHIPPING_THRESHOLD) })],
              ].map(([title, d]) => (
                <details key={title} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[12px] uppercase tracking-[0.2em]">
                    {title}
                    <span className="transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-5 text-[14px] leading-relaxed opacity-70">{d}</p>
                </details>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Related */}
      {relatedOthers.length > 0 && (
        <section className="mt-28">
          <Reveal>
            <h2 className="font-display text-3xl uppercase md:text-5xl">{t("product.wearsWellWith")}</h2>
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
