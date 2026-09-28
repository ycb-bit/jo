"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HeroCloth } from "@/components/hero-cloth";
import { ProductCard } from "@/components/product-card";
import { ProductArt } from "@/components/product-art";
import { Reveal } from "@/components/reveal";
import { Magnetic } from "@/components/magnetic";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, limit, orderBy } from "firebase/firestore";
import { LookImage } from "@/components/look-image";
import type { Product, Look } from "@/lib/types";

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const heroRef = typeof window === "undefined" ? null : null;
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, 140]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.15]);
  const backY = useTransform(scrollY, [0, 700], [0, 60]); // back type drifts slower
  const frontY = useTransform(scrollY, [0, 700], [0, -240]); // front type slides up and away

  useEffect(() => {
    // Latest 8 published pieces — the drop, newest first (no more featured flag)
    const q = query(
      collection(db, "products"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(8)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setFeatured(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]),
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "lookbook"), orderBy("createdAt", "desc"), limit(6));
    return onSnapshot(
      q,
      (snap) => setLooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Look[]),
      () => {}
    );
  }, []);

  return (
    <div>
      {/* ============ HERO — type woven through floating cloth ============ */}
      <section className="relative flex h-[100svh] items-center justify-center overflow-hidden">
        {/* the floating cloth — between the type layers */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-10">
          <HeroCloth />
        </motion.div>

        {/* headline — difference-blend: ink on the page, flips to a sharp
            light color wherever the fabric passes under it */}
        <motion.div
          style={{ y: backY, opacity: heroOpacity, mixBlendMode: "difference" }}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6"
        >
          <motion.h1
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-center text-[17vw] font-black uppercase leading-[0.82] md:text-[11vw]"
            style={{
              color: "#FFFFFF",
              WebkitTextStroke: "0.018em #FFFFFF",
            }}
          >
            Cloth,
            <br />
            made to be
          </motion.h1>
        </motion.div>

        {/* front type — in front of the cloth, difference-blended so it stays
            high-contrast over the fabric on every screen size (mobile included) */}
        <motion.div
          style={{ y: frontY, opacity: heroOpacity, mixBlendMode: "difference" }}
          className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center px-6 pb-[10svh]"
        >
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4 text-[11px] uppercase tracking-[0.34em] opacity-70"
            >
              Independent cloth maker — Est. in a garage, worn everywhere
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[17vw] font-black uppercase leading-[0.82] md:text-[11vw]"
              style={{ color: "#FFFFFF" }}
            >
              worn out.
            </motion.h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="absolute bottom-8 z-10 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] opacity-60"
        >
          <span>Scroll</span>
          <motion.span
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="block h-8 w-px bg-ink"
          />
        </motion.div>
      </section>

      {/* ============ MANIFESTO ============ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <p className="max-w-4xl font-display text-3xl uppercase leading-[1.05] md:text-6xl">
              One pair of hands. A single Juki. Fabric sourced in small lots and cut like it
              matters — <span className="text-ember">because it does.</span>
            </p>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-8 max-w-xl text-[15px] leading-relaxed opacity-70">
              JO is not a brand with a factory. It&apos;s a cloth maker with a waiting list.
              Every garment is numbered, signed inside the hem, and built to outlive the trend
              that bought it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ FEATURED DROP ============ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 md:py-28">
          <div className="mb-10 flex items-end justify-between">
            <Reveal>
              <h2 className="font-display text-4xl uppercase md:text-6xl">Latest drop</h2>
            </Reveal>
            <Reveal delay={100}>
              <Link href="/shop" className="u-link text-[12px] uppercase tracking-[0.2em]">
                View all →
              </Link>
            </Reveal>
          </div>
          {featured.length === 0 ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[4/5]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-7">
              {featured.slice(0, 8).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ LOOKBOOK MARQUEE ============ */}
      <section className="overflow-hidden border-y border-line bg-bone-dim py-14 md:py-20">
        <p className="mb-8 text-center text-[11px] uppercase tracking-[0.3em] opacity-50">
          The album — straight from the bench
        </p>
        {looks.length === 0 ? (
          <motion.div className="flex w-max gap-5 md:gap-8" animate={{ x: ["0%", "-50%"] }} transition={{ repeat: Infinity, duration: 38, ease: "linear" }}>
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex gap-5 md:gap-8">
                {["look-01", "look-02", "look-03", "look-04", "look-05", "look-06"].map((seed, i) => (
                  <div key={seed} className="relative h-[300px] w-[220px] shrink-0 overflow-hidden md:h-[420px] md:w-[320px]">
                    <ProductArt seed={seed} variant={i % 3} className="h-full w-full" />
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4 px-5 md:grid-cols-6 md:px-10">
            {looks.slice(0, 6).map((l) => (
              <a key={l.id} href="/lookbook" className="group">
                <LookImage path={l.imagePath} alt={l.title || "Lookbook frame"} className="aspect-[3/4] w-full" />
                <p className="mt-2 truncate text-[10px] uppercase tracking-[0.16em] opacity-50 group-hover:opacity-100">
                  {l.title || "Untitled"}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ============ PROCESS ============ */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36">
        <Reveal>
          <h2 className="font-display text-4xl uppercase md:text-6xl">How a JO happens</h2>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            ["01", "Sourced", "Deadstock and small-lot fabric, bought once. When it's gone, it's gone — most pieces never repeat."],
            ["02", "Cut & sewn", "One pattern cutter, one machinist, zero rush. A jacket takes two days. That's the point."],
            ["03", "Numbered", "Every piece is signed and numbered inside the hem. Yours is the only one like it."],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 120}>
              <div className="border-t border-ink pt-6">
                <p className="font-display text-ember text-2xl">{n}</p>
                <h3 className="font-display mt-3 text-2xl uppercase">{t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed opacity-70">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="mt-16">
            <Magnetic>
              <Link
                href="/shop"
                className="inline-block border border-ink bg-ink px-10 py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors duration-300 hover:bg-ember hover:border-ember"
              >
                Shop the drop
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
