import { CURRENCY, FREE_SHIPPING_THRESHOLD } from "./theme";

export { FREE_SHIPPING_THRESHOLD };

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Price for a specific variant — falls back to the base price. */
export function variantPrice(
  p: { price: number; priceOverrides?: Record<string, number> },
  color: string,
  size: string
): number {
  const o = p.priceOverrides?.[`${color}|${size}`];
  return typeof o === "number" && o > 0 ? o : p.price;
}

export function formatMoney(n: number, currency = CURRENCY) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function makeOrderRef() {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `JO-${t}${r}`;
}

export function variantKey(color: string, size: string) {
  return `${color}|${size}`;
}

export function totalStock(stock: Record<string, number>) {
  return Object.values(stock).reduce((a, b) => a + b, 0);
}

export function stockFor(stock: Record<string, number>, color: string, size: string) {
  return stock[variantKey(color, size)] ?? 0;
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
