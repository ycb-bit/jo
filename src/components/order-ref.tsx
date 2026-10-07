"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The order reference (JO-29P753MB) shown big and copyable.
 *
 * It is the one thing a customer needs when they talk to Jo about an order —
 * by phone, in the bank transfer memo, or when searching for it again — so it
 * gets its own block rather than hiding inside a paragraph.
 */
export function OrderRef({
  value,
  label = "Your reference",
  hint = "Quote this in the payment memo, and keep it — you can search your order with it.",
  className,
}: {
  value: string;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("border border-ink p-6", className)}>
      <p className="text-[11px] uppercase tracking-[0.2em] opacity-60">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <p className="font-display text-3xl tracking-[0.06em] select-all md:text-4xl">{value}</p>
        <button
          onClick={copy}
          className="border border-line px-3 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors hover:border-ink"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {hint && <p className="mt-3 text-[12px] leading-relaxed opacity-55">{hint}</p>}
    </div>
  );
}