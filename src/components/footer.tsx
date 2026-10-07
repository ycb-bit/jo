"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Reveal } from "./reveal";

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-line bg-ink text-bone">
      <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <Reveal>
          <p className="font-display text-[13vw] font-black uppercase leading-[0.85] md:text-[9vw]">
            Worn out<span className="text-ember">,</span>
            <br />
            not worn off<span className="text-ember">.</span>
          </p>
        </Reveal>
        <div className="mt-14 grid gap-10 border-t border-bone/15 pt-10 text-sm md:grid-cols-4">
          <div className="opacity-70">
            <p className="font-display text-xl uppercase">JO<span className="text-ember">.</span></p>
            <p className="mt-3 max-w-xs leading-relaxed">
              Independent cloth maker. Every piece is cut, sewn and finished by one pair of hands.
            </p>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">Shop</p>
            <ul className="space-y-2.5">
              <li><Link href="/shop" className="u-link">All garments</Link></li>
              <li><Link href="/shop?category=outerwear" className="u-link">Outerwear</Link></li>
              <li><Link href="/shop?category=knitwear" className="u-link">Knitwear</Link></li>
              <li><Link href="/wishlist" className="u-link">Saved items</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">Support</p>
            <ul className="space-y-2.5">
              <li><Link href="/track" className="u-link">Track an order</Link></li>
              <li><Link href="/account" className="u-link">Your account</Link></li>
              <li><Link href="/about#care" className="u-link">Garment care</Link></li>
              <li><Link href="/about#shipping" className="u-link">Shipping &amp; returns</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">The boring bits</p>
            <p className="opacity-70 leading-relaxed">
              Payments are made by bank transfer through our payment link and verified by a human —
              usually within a few hours. No cards, no middlemen.
            </p>
          </div>
        </div>
        <p className="mt-12 text-[11px] uppercase tracking-[0.2em] opacity-40">
          © {new Date().getFullYear()} JO Studio — Cut &amp; sewn with intent
        </p>
      </div>
    </footer>
  );
}
