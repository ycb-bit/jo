"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ProductArt } from "@/components/product-art";
import { Magnetic } from "@/components/magnetic";
import { BackButton } from "@/components/back-button";
import { useT } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useT();

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <BackButton />
      <Reveal>
        <h1 className="font-display text-[13vw] font-black uppercase leading-[0.85] md:text-[7.5vw]">
          {t("about.titleA")}<br />{t("about.titleB")}<span className="text-ember">.</span>
        </h1>
      </Reveal>

      <div className="mt-16 grid gap-14 lg:grid-cols-2">
        <Reveal>
          <div className="space-y-6 text-[15px] leading-relaxed opacity-80">
            <p>
              {t("about.p1")}
            </p>
            <p>
              {t("about.p2")}
            </p>
            <p className="border-l-2 border-ember pl-5 font-display text-xl uppercase leading-snug">
              &ldquo;{t("about.quote")}&rdquo;
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="h-[420px] md:h-[560px]">
            <ProductArt seed="studio-wall" className="h-full w-full" label={t("about.studio")} />
          </div>
        </Reveal>
      </div>

      <div className="mt-24 grid gap-10 md:grid-cols-2">
        <section id="care" className="scroll-mt-24 border-t border-ink pt-8">
          <h2 className="font-display text-3xl uppercase">{t("about.care")}</h2>
          <ul className="mt-5 space-y-3 text-[14px] leading-relaxed opacity-75">
            <li>— {t("about.care1")}</li>
            <li>— {t("about.care2")}</li>
            <li>— {t("about.care3")}</li>
            <li>— {t("about.care4")}</li>
          </ul>
        </section>
        <section id="shipping" className="scroll-mt-24 border-t border-ink pt-8">
          <h2 className="font-display text-3xl uppercase">{t("about.shipping")}</h2>
          <ul className="mt-5 space-y-3 text-[14px] leading-relaxed opacity-75">
            <li>— {t("about.ship1")}</li>
            <li>— {t("about.ship2")}</li>
            <li>— {t("about.ship3")}</li>
            <li>— {t("about.ship4")}</li>
          </ul>
        </section>
      </div>

      <div className="mt-20 text-center">
        <Magnetic>
          <Link href="/shop" className="inline-block border border-ink bg-ink px-10 py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember">
            {t("about.cta")}
          </Link>
        </Magnetic>
      </div>
    </div>
  );
}
