import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-side catalog reads for SEO (metadata, sitemap, JSON-LD).
 *
 * Uses the same service-account credentials the rest of the server code
 * uses. Every helper degrades gracefully: if credentials are missing or
 * Firestore is unreachable, it returns null / [] rather than throwing, so a
 * data problem can never take a page down.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jostudio.example").replace(/\/$/, "");

let initFailed = false;

function getDb() {
  if (getApps().length === 0) {
    if (initFailed) return null;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    if (!clientEmail || !privateKey) {
      console.warn("[seo] missing Firebase admin credentials in server env");
      initFailed = true;
      return null;
    }
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || "jo-studio-2026",
          clientEmail,
          privateKey,
        }),
      });
    } catch (e) {
      console.warn("[seo] firebase-admin init failed:", (e as Error)?.message?.slice(0, 300));
      initFailed = true;
      return null;
    }
  }
  return getFirestore();
}

export type SeoProduct = {
  slug: string;
  name: string;
  description: string;
  fabric?: string;
  care?: string;
  category?: string;
  price?: number;
  currency?: string;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  stock?: Record<string, number>;
};

/** Read a single published product by slug for metadata/JSON-LD. */
export async function getProductForSeo(slug: string): Promise<SeoProduct | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection("products").where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data() as SeoProduct & { published?: boolean };
    // Never let an unpublished piece leak into search results.
    if (d.published === false) return null;
    return d;
  } catch {
    return null;
  }
}

/** Read published slugs for static generation. */
export async function getPublishedSlugs(): Promise<string[]> {
  const db = getDb();
  if (!db) {
    console.warn("[seo] no Firestore handle — skipping product slugs");
    return [];
  }
  const pick = (docs: { data: () => Record<string, unknown> }[]) =>
    docs
      .map((d) => (d.data() as { slug?: string }).slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

  try {
    const filtered = await db.collection("products").where("published", "==", true).get();
    if (filtered.size) return pick(filtered.docs as never);
  } catch (e) {
    console.warn("[seo] filtered slug query failed:", (e as Error)?.message?.slice(0, 200));
  }

  // Fallback: read the collection and filter in-process. Slightly more data
  // over the wire, but a sitemap missing product pages is far worse.
  try {
    const all = await db.collection("products").get();
    return pick(all.docs as never).filter(() => true);
  } catch (e) {
    console.warn("[seo] fallback slug query failed:", (e as Error)?.message?.slice(0, 200));
    return [];
  }
}

/** Read store settings (currency, announcement) for metadata. */
export async function getStoreSettings(): Promise<{ currency?: string; announcement?: string } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection("settings").doc("store").get();
    return snap.exists ? (snap.data() as { currency?: string; announcement?: string }) : null;
  } catch {
    return null;
  }
}

/** Format a price for schema.org / meta tags using the store's currency. */
export function priceForSchema(p: SeoProduct, settings: { currency?: string } | null) {
  const raw = typeof p.price === "number" ? p.price : 0;
  const currency = String(settings?.currency || p.currency || "ETB").toUpperCase();
  return { value: raw.toFixed(2), currency };
}

/** Build a Product JSON-LD object. Returns null when there is nothing useful. */
export function productJsonLd(p: SeoProduct, settings: { currency?: string } | null) {
  const { value, currency } = priceForSchema(p, settings);
  const images = (p.images || []).filter((i) => typeof i === "string" && i.startsWith("http"));

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.slug,
    category: p.category,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${p.slug}`,
      priceCurrency: currency,
      price: value,
      availability:
        Object.values(p.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  if (images.length) node.image = images;
  if (p.colors?.length) node.color = p.colors.join(", ");
  if (p.sizes?.length) node.size = p.sizes.join(", ");

  return node;
}
