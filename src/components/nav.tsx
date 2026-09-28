"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, useWishlist } from "@/lib/store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=outerwear", label: "Outerwear" },
  { href: "/shop?category=knitwear", label: "Knitwear" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/about", label: "The Studio" },
];

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const cartCount = useCart((s) => s.lines.reduce((a, l) => a + l.qty, 0));
  const wishCount = useWishlist((s) => s.productIds.length);
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  if (isAdminRoute) return null;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-line backdrop-blur-md transition-all duration-500",
          scrolled ? "bg-bone/85" : "bg-bone/60"
        )}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-10">
          <button
            aria-label="Menu"
            className="u-link text-[12px] uppercase tracking-[0.2em] md:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Menu"}
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="u-link text-[12px] uppercase tracking-[0.18em]">
                {l.label}
              </Link>
            ))}
          </nav>

          <Link href="/" className="font-display text-[26px] font-black uppercase leading-none tracking-tight">
            JO<span className="text-ember">.</span>
          </Link>

          <div className="flex items-center gap-5 text-[12px] uppercase tracking-[0.18em]">
            <Link href="/wishlist" className="u-link hidden sm:inline" aria-label="Wishlist">
              Saved{wishCount > 0 && <sup className="ml-0.5 text-ember">{wishCount}</sup>}
            </Link>
            {user ? (
              <div className="hidden items-center gap-4 sm:flex">
                <Link href="/account" className="u-link">Account</Link>
                <button className="u-link opacity-60 hover:opacity-100" onClick={() => signOut(auth)}>
                  Out
                </button>
              </div>
            ) : (
              <Link href="/login" className="u-link hidden sm:inline">Sign in</Link>
            )}
            <Link href="/cart" className="u-link">
              Bag{cartCount > 0 && <sup className="ml-0.5 text-ember">{cartCount}</sup>}
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-[57px] z-40 border-b border-line bg-bone px-6 py-8 md:hidden"
          >
            <nav className="flex flex-col gap-5">
              {LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="font-display text-2xl uppercase">
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-6 text-[12px] uppercase tracking-[0.18em] opacity-70">
                <Link href="/wishlist">Saved</Link>
                <Link href={user ? "/account" : "/login"}>{user ? "Account" : "Sign in"}</Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
