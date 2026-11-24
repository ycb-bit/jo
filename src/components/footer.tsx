"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Reveal } from "./reveal";
import { useT } from "@/lib/i18n";

export function Footer() {
  const pathname = usePathname();
  const { t } = useT();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-line bg-ink text-bone">
      <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <Reveal>
          <p className="font-display text-[13vw] font-black uppercase leading-[0.85] md:text-[9vw]">
            {t("footer.line1")}
            <br />
            {t("footer.line2")}
          </p>
        </Reveal>
        <div className="mt-14 grid gap-10 border-t border-bone/15 pt-10 text-sm md:grid-cols-4">
          <div className="opacity-70">
            <p className="font-display text-xl uppercase">JO<span className="text-ember">.</span></p>
            <p className="mt-3 max-w-xs leading-relaxed">{t("footer.blurb")}</p>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">{t("footer.shop")}</p>
            <ul className="space-y-2.5">
              <li><Link href="/shop" className="u-link">{t("footer.allGarments")}</Link></li>
              <li><Link href="/lookbook" className="u-link">{t("nav.lookbook")}</Link></li>
              <li><Link href="/wishlist" className="u-link">{t("footer.savedItems")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">{t("footer.support")}</p>
            <ul className="space-y-2.5">
              <li><Link href="/track" className="u-link">{t("footer.trackOrder")}</Link></li>
              <li><Link href="/account" className="u-link">{t("footer.yourAccount")}</Link></li>
              <li><Link href="/about#care" className="u-link">{t("footer.care")}</Link></li>
              <li><Link href="/about#shipping" className="u-link">{t("footer.shipping")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] opacity-50">{t("footer.boring")}</p>
            <p className="opacity-70 leading-relaxed">{t("footer.boringBody")}</p>
          </div>
        </div>
        <p className="mt-12 text-[11px] uppercase tracking-[0.2em] opacity-40">
          © {new Date().getFullYear()} {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
