"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { LookImage } from "@/components/look-image";
import { Reveal } from "@/components/reveal";
import type { Look } from "@/lib/types";

export default function LookbookPage() {
  const [looks, setLooks] = useState<Look[]>([]);
  const [zoom, setZoom] = useState<Look | null>(null);

  useEffect(() => {
    const q = query(collection(db, "lookbook"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (s) => setLooks(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Look[]));
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-24 pt-16 md:px-10">
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.34em] opacity-60">The album</p>
        <h1 className="font-display mt-4 text-5xl uppercase leading-[0.9] md:text-7xl">
          Lookbook<span className="text-ember">.</span>
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed opacity-70">
          Frames from the bench, the cutting table and the street. Jo adds to the album as
          the work happens — nothing staged, nothing retouched.
        </p>
      </Reveal>

      {looks.length === 0 ? (
        <div className="mt-20 border border-dashed border-line p-16 text-center">
          <p className="font-display text-2xl uppercase opacity-60">The album is empty</p>
          <p className="mt-3 text-[13px] opacity-50">
            Jo hasn&apos;t added any frames yet. Check back after the next drop.
          </p>
        </div>
      ) : (
        <div className="mt-14 columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
          {looks.map((l, i) => (
            <motion.button
              key={l.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setZoom(l)}
              className="group block w-full cursor-zoom-in text-left"
            >
              <LookImage
                path={l.imagePath}
                alt={l.title || "Lookbook frame"}
                className="aspect-auto min-h-40 w-full"
              />
              {l.title && (
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] opacity-60 group-hover:opacity-100">
                  {l.title}
                </p>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm md:p-10"
          onClick={() => setZoom(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-full w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <LookImage path={zoom.imagePath} alt={zoom.title || "Lookbook frame"} className="max-h-[80svh] w-full" />
            <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-bone/70">
              <span>{zoom.title || "Untitled frame"}</span>
              <button className="u-link" onClick={() => setZoom(null)}>Close</button>
            </div>
          </motion.div>
          <button
            aria-label="Close"
            className="absolute right-6 top-6 text-[12px] uppercase tracking-[0.2em] text-bone/60 hover:text-bone"
            onClick={() => setZoom(null)}
          >
            Close ✕
          </button>
        </div>
      )}
    </div>
  );
}
