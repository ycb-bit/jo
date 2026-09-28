"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ProductArt } from "@/components/product-art";
import { Magnetic } from "@/components/magnetic";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-28 pt-14 md:px-10">
      <Reveal>
        <h1 className="font-display text-[13vw] font-black uppercase leading-[0.85] md:text-[7.5vw]">
          Jo makes<br />clothes<span className="text-ember">.</span>
        </h1>
      </Reveal>

      <div className="mt-16 grid gap-14 lg:grid-cols-2">
        <Reveal>
          <div className="space-y-6 text-[15px] leading-relaxed opacity-80">
            <p>
              JO started with one machine, one pattern-cutter and a stubborn belief: that the
              clothes people keep are the ones someone actually made. No seasonal calendar. No
              factory floor. Just small runs of fabric, found once, cut properly.
            </p>
            <p>
              Every piece that leaves the studio is numbered and signed inside the hem. If you
              ever want to know exactly who made your jacket — you already do. It&apos;s Jo.
            </p>
            <p className="border-l-2 border-ember pl-5 font-display text-xl uppercase leading-snug">
              &ldquo;I&apos;d rather make 40 good garments than 4,000 forgettable ones.&rdquo;
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="h-[420px] md:h-[560px]">
            <ProductArt seed="studio-wall" className="h-full w-full" label="The studio" />
          </div>
        </Reveal>
      </div>

      <div className="mt-24 grid gap-10 md:grid-cols-2">
        <section id="care" className="scroll-mt-24 border-t border-ink pt-8">
          <h2 className="font-display text-3xl uppercase">Garment care</h2>
          <ul className="mt-5 space-y-3 text-[14px] leading-relaxed opacity-75">
            <li>— Wash cold, inside out, gentle cycle. Your garment&apos;s dye will thank you.</li>
            <li>— Skip the dryer. Line dry in shade; the fabric keeps its hand-feel longer.</li>
            <li>— Steam rather than iron where you can. Press cloth if you must iron.</li>
            <li>— Denim and canvas: repair, don&apos;t replace. Send it back — we patch JO pieces free for life.</li>
          </ul>
        </section>
        <section id="shipping" className="scroll-mt-24 border-t border-ink pt-8">
          <h2 className="font-display text-3xl uppercase">Shipping &amp; returns</h2>
          <ul className="mt-5 space-y-3 text-[14px] leading-relaxed opacity-75">
            <li>— Worldwide shipping is free. Always. It's built into the price.</li>
            <li>— Dispatched within 2 working days of payment verification.</li>
            <li>— 14-day returns on unworn pieces. Sale items are final.</li>
            <li>— Payments are bank transfer or mobile money — pick your method at checkout. A human verifies every receipt, usually within hours.</li>
          </ul>
        </section>
      </div>

      <div className="mt-20 text-center">
        <Magnetic>
          <Link href="/shop" className="inline-block border border-ink bg-ink px-10 py-4 text-[12px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-ember hover:bg-ember">
            See what&apos;s on the rack
          </Link>
        </Magnetic>
      </div>
    </div>
  );
}
