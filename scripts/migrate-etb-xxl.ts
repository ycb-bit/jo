/**
 * One-off migration for jo-studio-2026:
 *  1. Convert every product price (+ priceOverrides) USD → ETB at 162, rounded to 50.
 *  2. Append "XXL" to any size ladder that contains "XL" (stock starts at 0 — Jo stocks it).
 *  3. settings.currency → ETB, announcement refreshed (shipping is free now, no $150).
 * Idempotent: skips products already in ETB (price > 2000 is a giveaway).
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

if (getApps().length === 0) {
  initializeApp({ credential: cert("jo-service-account.json") });
}
const db = getFirestore();

const RATE = 162;
const toEtb = (usd: number) => Math.round((usd * RATE) / 50) * 50;

async function main() {
  // 1+2: products
  const snap = await db.collection("products").get();
  let priced = 0, sized = 0;
  for (const doc of snap.docs) {
    const p = doc.data() as {
      price?: number; priceOverrides?: Record<string, number>; sizes?: string[]; stock?: Record<string, number>;
    };
    const update: Record<string, unknown> = {};

    if (typeof p.price === "number" && p.price > 0 && p.price < 2000) {
      update.price = toEtb(p.price);
      if (p.priceOverrides && Object.keys(p.priceOverrides).length) {
        const conv: Record<string, number> = {};
        for (const [k, v] of Object.entries(p.priceOverrides)) {
          if (typeof v === "number" && v > 0 && v < 2000) conv[k] = toEtb(v);
          else conv[k] = v;
        }
        update.priceOverrides = conv;
      }
      priced++;
    }

    if (Array.isArray(p.sizes) && p.sizes.includes("XL") && !p.sizes.includes("XXL")) {
      update.sizes = [...p.sizes, "XXL"];
      sized++;
      // give XXL a stock entry (0 — Jo decides inventory) so the variant grid is coherent
      if (p.stock && !Object.keys(p.stock).some((k) => k.endsWith("|XXL"))) {
        const stock: Record<string, number> = { ...p.stock };
        for (const color of new Set(Object.keys(stock).map((k) => k.split("|")[0]))) {
          stock[`${color}|XXL`] = 0;
        }
        update.stock = stock;
      }
    }

    if (Object.keys(update).length) {
      await doc.ref.update(update);
      console.log(`  ${doc.id}: ${Object.keys(update).join(", ")}`);
    }
  }
  console.log(`Products: ${priced} converted to ETB, ${sized} given XXL`);

  // 3: settings
  await db.collection("settings").doc("store").set(
    {
      currency: "ETB",
      announcement: "Drop 04 is live — worldwide shipping is free",
    },
    { merge: true }
  );
  console.log("Settings: currency → ETB, announcement refreshed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
