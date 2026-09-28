"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const FALLBACK = "Free worldwide shipping over $150 — Hand-finished in small batches";

export function AnnouncementBar() {
  const [text, setText] = useState(FALLBACK);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "store"),
      (snap) => {
        const a = snap.data()?.announcement;
        if (a) setText(a);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const phrase = `${text}   ·   `;
  return (
    <div className="relative z-50 overflow-hidden border-b border-line bg-ink text-bone">
      <div className="flex w-max animate-marquee whitespace-nowrap py-2 text-[11px] uppercase tracking-[0.22em]">
        {Array.from({ length: 2 }).map((_, i) => (
          <span key={i} className="flex">
            {Array.from({ length: 4 }).map((_, j) => (
              <span key={j} className="pr-2">{phrase}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
