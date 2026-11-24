"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/lib/store";
import { CartThumb } from "@/components/cart-thumb";
import { formatMoney } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { BackButton } from "@/components/back-button";

export default function CartPage() {
  const cart = useCart();
  const { t } = useT();
  const [shipping, setShipping] = useState(8);

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "store"), (snap) => {
      setShipping(Number(snap.data()?.shippingFlat ?? 8));
    }, () => {});
  }, []);

  const subtotal = cart.subtotal();
  const freeShip = subtotal >= 150;
  const ship = subtotal === 0 ? 0 : freeShip ? 0 : shipping;

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-32 text-center md:px-10">
        <BackButton />
        <h1 className="font-display text-[12vw] font-black uppercase leading-none md:text-7xl">
          {t("cart.emptyTitle")}<span className="text-ember">.</span>
        </h1>
        <p className="mt-5 opacity-60">{t("cart.emptyBody")}</p>
        <Link
          href="/shop"
          className="mt-9 inline-block border border-ink bg-ink px-10 py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember"
        >
          {t("home.shopDrop")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      <h1 className="font-display text-5xl uppercase md:text-7xl">
        {t("cart.title")}<span className="text-ember">.</span>
      </h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-line border-y border-line">
          <AnimatePresence>
            {cart.lines.map((l) => (
              <motion.li
                key={`${l.productId}-${l.color}-${l.size}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -40 }}
                className="flex gap-5 py-6"
              >
                <Link href={`/product/${l.slug}`} className="block h-28 w-24 shrink-0 overflow-hidden bg-bone-dim">
                  <CartThumb image={l.image} seed={l.slug} className="h-full w-full object-cover" />
                </Link>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/product/${l.slug}`} className="u-link text-[15px] font-medium">{l.name}</Link>
                      <p className="mt-1 text-[12px] uppercase tracking-[0.14em] opacity-50">
                        {l.color} / {l.size}
                      </p>
                    </div>
                    <p className="tabular-nums">{formatMoney(l.unitPrice * l.qty)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-line">
                      <button
                        className="px-3 py-1.5 text-sm hover:bg-ink hover:text-bone"
                        onClick={() => cart.setQty(l.productId, l.color, l.size, l.qty - 1)}
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{l.qty}</span>
                      <button
                        className="px-3 py-1.5 text-sm hover:bg-ink hover:text-bone"
                        onClick={() => cart.setQty(l.productId, l.color, l.size, l.qty + 1)}
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="u-link text-[11px] uppercase tracking-[0.16em] opacity-50 hover:opacity-100"
                      onClick={() => cart.remove(l.productId, l.color, l.size)}
                    >
                      {t("cart.remove")}
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-ink p-7">
            <h2 className="font-display text-xl uppercase">{t("cart.summary")}</h2>
            <dl className="mt-5 space-y-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="opacity-60">{t("cart.subtotal")}</dt>
                <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">{t("cart.shipping")}</dt>
                <dd className="tabular-nums">{ship === 0 ? t("cart.free") : formatMoney(ship)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>{t("cart.total")}</dt>
                <dd className="tabular-nums">{formatMoney(subtotal + ship)}</dd>
              </div>
            </dl>
            {!freeShip && subtotal < 150 && (
              <p className="mt-4 text-[12px] opacity-55">
                {t("cart.freeShipLeft", { amount: formatMoney(150 - subtotal) })}
              </p>
            )}
            <Link
              href="/checkout"
              className="mt-7 block border border-ink bg-ink py-4 text-center text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember"
            >
              {t("cart.checkout")}
            </Link>
            <p className="mt-4 text-[11px] leading-relaxed opacity-50">
              {t("cart.note")}
            </p>
          </div>
          <Link href="/shop" className="u-link mt-6 inline-block text-[12px] uppercase tracking-[0.2em] opacity-60">
            {t("cart.keepBrowsing")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
