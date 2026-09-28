/**
 * Seeds the store with the catalog + settings.
 * Default: real project (jo-studio-2026) via jo-service-account.json.
 * Flag --emulator: seed the local emulators instead.
 */
import * as admin from "firebase-admin";

const EMULATOR = process.argv.includes("--emulator");

if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
}

const app = EMULATOR
  ? admin.initializeApp({ projectId: "demo-jo-studio" })
  : admin.initializeApp({
      credential: admin.credential.cert(require("../jo-service-account.json")),
      storageBucket: "jo-studio-2026.firebasestorage.app",
    });
const db = admin.firestore();

type Seed = {
  slug: string; name: string; description: string; fabric: string; care: string;
  price: number; category: string; colors: string[]; sizes: string[];
  stock: Record<string, number>;
};

const S = ["XS", "S", "M", "L", "XL", "XXL"];

const products: Seed[] = [
  {
    slug: "boxcar-overshirt", name: "Boxcar Overshirt",
    description: "A workwear box-cut overshirt in brushed 12oz canvas. Wears like a jacket, folds like a shirt. Two chest pockets, corozo buttons, double-stitched shoulders.",
    fabric: "12oz brushed Japanese canvas, deadstock", care: "Cold wash inside out. Line dry. Iron on reverse.",
    price: 148, category: "outerwear", colors: ["Bone", "Ink", "Clay"], sizes: S,
    stock: { "Bone|XS": 2, "Bone|S": 3, "Bone|M": 4, "Bone|L": 2, "Bone|XL": 1, "Ink|S": 2, "Ink|M": 3, "Ink|L": 3, "Ink|XL": 0, "Clay|M": 2, "Clay|L": 1 },
  },
  {
    slug: "nightshift-chore-coat", name: "Nightshift Chore Coat",
    description: "Jo's signature chore coat. Unlined, hammered cotton twill that softens into your shape within a week. Hidden interior pocket sized for a phone and a excuse to leave the house.",
    fabric: "14oz cotton twill, garment-washed", care: "Cold wash. Hang dry. It only gets better.",
    price: 210, category: "outerwear", colors: ["Ink", "Moss"], sizes: S,
    stock: { "Ink|S": 1, "Ink|M": 2, "Ink|L": 2, "Ink|XL": 1, "Moss|M": 1, "Moss|L": 2 },
  },
  {
    slug: "loom-heavy-crewneck", name: "Loom Heavy Crewneck",
    description: "480gsm loopback fleece crew, knitted on vintage machines so the collar never slumps. Boxy body, dropped shoulder, ribbed everything.",
    fabric: "480gsm loopback cotton fleece", care: "Cold wash, flat dry. Do not fear the pilling phase — it passes.",
    price: 96, category: "knitwear", colors: ["Bone", "Ink", "Ember"], sizes: S,
    stock: { "Bone|XS": 3, "Bone|S": 4, "Bone|M": 5, "Bone|L": 3, "Ink|S": 2, "Ink|M": 4, "Ink|L": 2, "Ink|XL": 2, "Ember|M": 2, "Ember|L": 1 },
  },
  {
    slug: "fisherman-mock-neck", name: "Fisherman Mock Neck",
    description: "Chunky 5-gauge mock neck with a saddle shoulder that actually sits where your shoulder is. Named after the sweaters Jo's grandfather refused to take off.",
    fabric: "5-gauge lambswool blend", care: "Hand wash cold. Dry flat. Store folded, never hung.",
    price: 165, category: "knitwear", colors: ["Oat", "Ink"], sizes: S,
    stock: { "Oat|S": 2, "Oat|M": 3, "Oat|L": 2, "Ink|M": 2, "Ink|XL": 1 },
  },
  {
    slug: "standard-issue-tee", name: "Standard Issue Tee",
    description: "The perfect tee, allegedly. 240gsm compact cotton, tubular body (no side seams to twist), neckline that survives the year. Sold in singles because you'll come back for more.",
    fabric: "240gsm compact-spun cotton", care: "Cold wash. Tumble dry low if you must.",
    price: 42, category: "tops", colors: ["Bone", "Ink", "Ember"], sizes: S,
    stock: { "Bone|XS": 6, "Bone|S": 8, "Bone|M": 8, "Bone|L": 6, "Bone|XL": 4, "Ink|S": 6, "Ink|M": 6, "Ink|L": 5, "Ink|XL": 3, "Ember|S": 3, "Ember|M": 3 },
  },
  {
    slug: "offcut-pocket-tee", name: "Offcut Pocket Tee",
    description: "Same body as the Standard Issue, with a chest pocket cut from the offcuts of bigger garments. No two pockets match. That's the whole idea.",
    fabric: "240gsm cotton body, mixed offcut pocket", care: "Cold wash inside out.",
    price: 48, category: "tops", colors: ["Mixed"], sizes: S,
    stock: { "Mixed|S": 4, "Mixed|M": 5, "Mixed|L": 3, "Mixed|XL": 2 },
  },
  {
    slug: "utility-cargo-pant", name: "Utility Cargo Pant",
    description: "Straight-leg cargo with bellows pockets deep enough to be useful and flat enough to be worn in public. Adjustable hem cinch, triple-needle seat.",
    fabric: "9oz ripstop cotton", care: "Cold wash. Line dry.",
    price: 132, category: "bottoms", colors: ["Ink", "Bone"], sizes: ["28", "30", "32", "34", "36"],
    stock: { "Ink|28": 2, "Ink|30": 3, "Ink|32": 3, "Ink|34": 2, "Ink|36": 1, "Bone|30": 2, "Bone|32": 2, "Bone|34": 1 },
  },
  {
    slug: "selvedge-work-trouser", name: "Selvedge Work Trouser",
    description: "A tailor's trouser built like workwear: high rise, single pleat, 13oz selvedge denim that starts stiff and ends up yours.",
    fabric: "13oz selvedge denim", care: "Wash rarely, cold, inside out. Hem after 3 wears if you must.",
    price: 185, category: "bottoms", colors: ["Raw Indigo"], sizes: ["28", "30", "32", "34", "36"],
    stock: { "Raw Indigo|28": 1, "Raw Indigo|30": 2, "Raw Indigo|32": 2, "Raw Indigo|34": 2, "Raw Indigo|36": 0 },
  },
  {
    slug: "quilted-liner-vest", name: "Quilted Liner Vest",
    description: "Diamond-quilted vest cut from the liner pattern of a coat we never made. Wear it under anything in winter, over everything in April.",
    fabric: "Quilted nylon shell, recycled fill", care: "Machine wash cold. Tumble low with tennis balls.",
    price: 118, category: "outerwear", colors: ["Bone", "Moss"], sizes: S,
    stock: { "Bone|S": 2, "Bone|M": 2, "Bone|L": 1, "Moss|M": 1, "Moss|L": 2, "Moss|XL": 1 },
  },
  {
    slug: "watch-cap-beanie", name: "Watch Cap Beanie",
    description: "Six-panel watch cap in ribbed lambswool. Short enough to not flop, long enough to actually cover your ears in February.",
    fabric: "Ribbed lambswool", care: "Hand wash. Dry flat on a towel.",
    price: 38, category: "accessories", colors: ["Ink", "Ember", "Oat"], sizes: ["One size"],
    stock: { "Ink|One size": 8, "Ember|One size": 5, "Oat|One size": 4 },
  },
  {
    slug: "canvas-tote-utility", name: "Utility Canvas Tote",
    description: "18oz canvas tote with a boxed base and riveted handles. Carries a laptop, two records and a baguette with equal dignity.",
    fabric: "18oz cotton canvas", care: "Spot clean. It will outlive us all.",
    price: 54, category: "accessories", colors: ["Bone", "Ink"], sizes: ["One size"],
    stock: { "Bone|One size": 6, "Ink|One size": 6 },
  },
  {
    slug: "ember-scarf", name: "Ember Wool Scarf",
    description: "Double-faced wool scarf in the studio's signature ember. Long enough to wrap twice; loud enough to find in a coat pile.",
    fabric: "Double-faced merino wool", care: "Dry clean or careful hand wash.",
    price: 78, category: "accessories", colors: ["Ember"], sizes: ["One size"],
    stock: { "Ember|One size": 4 },
  },
  {
    slug: "apron-maker-cut", name: "Maker's Apron",
    description: "The apron Jo wears at the bench, sold because everyone kept asking. Cross-back straps, six pockets, waxed canvas that takes a beating and looks better for it.",
    fabric: "Waxed 14oz canvas, brass hardware", care: "Wipe clean. Re-wax yearly.",
    price: 88, category: "accessories", colors: ["Ink", "Clay"], sizes: ["One size"],
    stock: { "Ink|One size": 3, "Clay|One size": 3 },
  },
  {
    slug: "weekend-oversized-shirt", name: "Weekend Oversized Shirt",
    description: "Deliberately too big. Dropped shoulders, curved hem, mother-of-pearl buttons, and a chest pocket for the sunglasses you'll sit on anyway.",
    fabric: "Airy cotton-linen poplin", care: "Cold wash. Hang dry. Creases are character.",
    price: 92, category: "tops", colors: ["Bone", "Sky"], sizes: S,
    stock: { "Bone|XS": 2, "Bone|S": 3, "Bone|M": 3, "Bone|L": 2, "Sky|M": 2, "Sky|L": 1 },
  },
];

async function main() {
  console.log(`Seeding ${EMULATOR ? "EMULATORS" : "REAL project jo-studio-2026"}…`);
  const batch = db.batch();
  const now = Date.now();

  products.forEach((p, i) => {
    const ref = db.collection("products").doc(p.slug);
    batch.set(ref, {
      ...p,
      images: [],
      published: true,
      createdAt: now - i * 86_400_000,
      updatedAt: now,
    });
  });

  batch.set(db.collection("settings").doc("store"), {
    currency: "ETB",
    handlingFee: 0,
    paymentMethods: [],
    announcement: "Drop 04 is live — worldwide shipping is free",
  });

  await batch.commit();
  console.log(`✓ Seeded ${products.length} products + store settings`);
  await app.delete();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
