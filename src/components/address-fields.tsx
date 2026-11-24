"use client";

import { cn } from "@/lib/utils";
import type { Address } from "@/lib/types";
import { useT } from "@/lib/i18n";

/**
 * The one address form for the whole store.
 *
 * Used by the account address book and by checkout step 1 so the fields,
 * placeholders and autofill behaviour never drift apart. Nothing is assumed
 * about where the parcel goes: country is a field, not a hidden default.
 */

const AUTOCOMPLETE: Partial<Record<keyof Address, string>> = {
  label: "organization",
  fullName: "name",
  phone: "tel",
  line1: "address-line1",
  line2: "address-line2",
  city: "address-level2",
  subCity: "address-level3",
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
  const { t } = useT();

  const field = (
    key: keyof Address,
    placeholder: string,
    opts?: { wide?: boolean; type?: string }
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
      {showLabel && field("label", t("address.label"))}
      {field("fullName", t("address.fullName"))}
      {field("phone", t("address.phone"), { type: "tel" })}
      {field("line1", t("address.line1"), { wide: true })}
      {field("line2", t("address.line2"), { wide: true })}
      {field("city", t("address.city"))}
      {field("subCity", t("address.subCity"))}
      {field("country", t("address.country"))}
      <p className="self-end pb-2 text-[12px] leading-relaxed opacity-55">
        {t("address.note")}
      </p>
    </div>
  );
}
