"use client";

import { addressLines, addressTitle } from "@/lib/addresses";
import type { Address } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One saved-address card. Used by the account address book (with Edit / Remove
 * / Make default actions) and by the checkout picker (click to select).
 */
export function AddressCard({
  address,
  selected = false,
  onSelect,
  actions,
  className,
}: {
  address: Address;
  selected?: boolean;
  onSelect?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{addressTitle(address)}</p>
        {address.isDefault && (
          <span className="shrink-0 border border-ember px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-ember">
            Default
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-[13px] leading-relaxed opacity-70">
        {addressLines(address).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>{address.country || "Ethiopia"}</p>
        <p className="tabular-nums">{address.phone}</p>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "border p-5 text-[13px] transition-colors",
        selected ? "border-ink bg-bone-dim/40" : "border-line",
        onSelect && "hover:border-ink",
        className
      )}
    >
      {onSelect ? (
        <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={selected}>
          {body}
          <span className="mt-3 block text-[11px] uppercase tracking-[0.18em] text-ember">
            {selected ? "Shipping here ✓" : "Ship here"}
          </span>
        </button>
      ) : (
        body
      )}
      {actions && (
        <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-[11px] uppercase tracking-[0.16em]">
          {actions}
        </div>
      )}
    </div>
  );
}