/**
 * Read-only probe of the real Firestore project.
 * Verifies credentials work and prints the live catalog shape.
 * Safe to re-run: it only reads.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const cfg = {
  projectId: process.env.FIREBASE_PROJECT_ID || "jo-studio-2026",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(cfg),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "jo-studio-2026.firebasestorage.app",
  });
}
const db = getFirestore();

type P = {
  slug?: string;
  name?: string;
  price?: number;
  currency?: string;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  category?: string;
  description?: string;
};

(async () => {
  const products = await db.collection("products").get();
  console.log("PRODUCTS:", products.size);
  for (const d of products.docs) {
    const p = d.data() as P;
    const imgs = p.images || [];
    const sample = imgs[0] ? String(imgs[0]).slice(0, 60) : "(none)";
    console.log(
      `  - ${p.slug} | ${p.name} | ${p.price} | imgs=${imgs.length} | colors=${(p.colors || []).length} | sizes=${(p.sizes || []).length} | first=${sample}`
    );
  }

  const settings = await db.collection("settings").doc("store").get();
  console.log("SETTINGS:", JSON.stringify(settings.data() || {}));

  const counts: Record<string, number> = {};
  for (const c of ["orders", "users", "lookbook"]) {
    try {
      const s = await db.collection(c).count().get();
      counts[c] = s.data().count;
    } catch {
      counts[c] = -1;
    }
  }
  console.log("COUNTS:", JSON.stringify(counts));
  process.exit(0);
})().catch((e: any) => {
  console.error("FAIL:", e?.code || "", String(e?.message || "").slice(0, 300));
  process.exit(1);
});
