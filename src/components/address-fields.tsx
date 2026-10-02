"use client";

import { cn } from "@/lib/utils";
import type { Address } from "@/lib/types";

/**
 * The one address form for the whole store.
 *
 * Used by the account address book and by checkout step 1 so the fields,
 * placeholders and autofill behaviour never drift apart. Ethiopia-flavoured
 * copy (woreda / sub-city) because that is where the cloth ships from.
 */

const AUTOCOMPLETE: Partial<Record<keyof Address, string>> = {
  label: "organization",
  fullName: "name",
  phone: "tel",
  line1: "address-line1",
  line2: "address-line2",
  city: "address-level2",
  subCity: "address-level3",
  region: "address-level1",
  country: "country-name",
};

export function AddressFields({
  address,
  onChange,
  showLabel = false,
  className,
}: {
  address: Address;
  onChange: (next: Address) => void;
  /** Optional "Home / Studio" nickname — the account book shows it. */
  showLabel?: boolean;
  className?: string;
}) {
  const field = (
    key: keyof Address,
    placeholder: string,
    opts?: { wide?: boolean; type?: string; required?: boolean }
  ) => (
    <label className={opts?.wide ? "sm:col-span-2" : ""}>
      <input
        className="input"
        type={opts?.type || "text"}
        placeholder={placeholder}
        aria-label={placeholder}
        value={String(address[key] ?? "")}
        autoComplete={AUTOCOMPLETE[key]}
        onChange={(e) => onChange({ ...address, [key]: e.target.value })}
      />
      </label>
  );

  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>
      {showLabel && field("label", "Label — Home, Studio, Mum's place")}
      {field("fullName", "Full name")}
      {field("phone", "Phone", { type: "tel" })}
      {field("line1", "Street / landmark — e.g. Bole Rwanda St, near Getu Commercial", { wide: true })}
      {field("line2", "Apartment, building, office (optional)", { wide: true, required: false })}
      {field("city", "City")}
      {field("subCity", "Sub-city / woreda — e.g. Bole, Yeka, Arada", { required: false })}
      {field("region", "Region")}
      <p className="self-end pb-2 text-[12px] leading-relaxed opacity-55">
        Shipping is free storewide, worldwide. We default to Ethiopia — tell us if it&apos;s
        going elsewhere.
      </p>
    </div>
  );
}