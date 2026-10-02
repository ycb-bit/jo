import type { Address } from "./types";

/**
 * Address-book helpers.
 *
 * Saved addresses live in a plain array on the user document, so these
 * functions keep the rules in one place: every address gets a stable id, at
 * most one is the default, and the order they come back in is stable so the
 * checkout picker does not reshuffle between renders.
 */

export const EMPTY_ADDRESS: Address = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  subCity: "",
  postalCode: "",
  country: "Ethiopia",
  phone: "",
};

/**
 * Short id without pulling in a uuid dependency. Only needs to be unique
 * inside one user's address array.
 */
export function addressId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Fields the store actually needs to ship an order. */
export function missingAddressFields(a: Partial<Address>): string[] {
  const missing: string[] = [];
  if (!a.fullName?.trim()) missing.push("Full name");
  if (!a.phone?.trim()) missing.push("Phone");
  if (!a.line1?.trim()) missing.push("Street");
  if (!a.city?.trim()) missing.push("City");
  return missing;
}

export function isAddressComplete(a: Partial<Address>): boolean {
  return missingAddressFields(a).length === 0;
}

/** The label a saved card shows: its own label, else its recipient. */
export function addressTitle(a: Address): string {
  return a.label?.trim() || a.fullName?.trim() || "Address";
}

/** One-line-ish summary for the picker card. */
export function addressLines(a: Address): string[] {
  const lines = [a.line1, a.line2].filter(Boolean) as string[];
  const locality = [a.subCity, a.city].filter(Boolean).join(", ");
  if (locality) lines.push(locality);
  if (a.region) lines.push(a.region);
  return lines;
}

/** The address checkout should offer first: the default, else the first. */
export function defaultAddress(addresses: Address[] | undefined): Address | null {
  if (!addresses?.length) return null;
  return addresses.find((a) => a.isDefault) || addresses[0];
}

/**
 * Normalizes a user document's addresses: fills in ids, trims stray blanks,
 * and guarantees exactly one default. Safe to run on every render.
 */
export function normalizeAddresses(addresses: Address[] | undefined): Address[] {
  const list = (addresses || [])
    .filter((a) => a && typeof a === "object")
    .map((a) => ({
      ...a,
      id: a.id || addressId(),
      line2: a.line2 || "",
      subCity: a.subCity || "",
      postalCode: a.postalCode || "",
      country: a.country || "Ethiopia",
    }));

  if (!list.length) return [];

  // If the user never marked one, treat the first entry as the default so
  // checkout always has something sensible to pre-select.
  const hasDefault = list.some((a) => a.isDefault);
  return list.map((a, i) => ({ ...a, isDefault: hasDefault ? !!a.isDefault : i === 0 }));
}

/**
 * Writes an updated address list back to the user document: keeps a single
 * default, and does not duplicate an address the user already saved.
 */
export function withAddress(
  addresses: Address[],
  next: Address,
  opts: { makeDefault?: boolean } = {}
): Address[] {
  const list = addresses.map((a) => ({ ...a }));
  const id = next.id || addressId();

  // Same street + recipient is the same address — update it in place rather
  // than filling the book with near-duplicates.
  const dupe = list.findIndex(
    (a) => a.id === id || (a.line1?.trim() === next.line1?.trim() && a.fullName?.trim() === next.fullName?.trim())
  );

  const entry: Address = { ...next, id, isDefault: opts.makeDefault ? true : !!next.isDefault };

  if (dupe >= 0) list[dupe] = { ...list[dupe], ...entry };
  else list.push(entry);

  // Exactly one default.
  if (!list.some((a) => a.isDefault)) list[0].isDefault = true;
  if (opts.makeDefault) for (const a of list) if (a.id !== id) a.isDefault = false;

  return list;
}

export function withoutAddress(addresses: Address[], id: string): Address[] {
  const list = addresses.filter((a) => a.id !== id);
  // Never leave the book without a default.
  if (list.length && !list.some((a) => a.isDefault)) list[0].isDefault = true;
  return list;
}