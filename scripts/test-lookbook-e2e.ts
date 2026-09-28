/**
 * E2E check of the new lookbook data-URI shape (no Storage involved).
 * Creates a doc in `lookbook` with an inline data URI, reads it back,
 * asserts fields, deletes it. Safe to run any time.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

if (getApps().length === 0) {
  initializeApp({ credential: cert("jo-service-account.json") });
}
const db = getFirestore();

const TINY_DATA_URI =
  "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TBUAAAAvAAAAAAfQ//73v/+BiOh/AAA=";

async function main() {
  const ref = db.collection("lookbook").doc("e2e-test-look");
  const now = Date.now();

  await ref.set({
    title: "E2E check",
    caption: "temporary test frame",
    imageData: TINY_DATA_URI,
    createdAt: now,
    sortOrder: 9999,
  });

  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data?.imageData?.startsWith("data:image/")) {
    throw new Error("FAIL: imageData data-URI did not round-trip");
  }

  await ref.delete();
  const gone = await ref.get();
  console.log(
    `E2E OK — wrote data-URI look (${JSON.stringify(data.imageData).length} bytes), read it back, deleted (exists=${gone.exists})`
  );
}

main().catch((e) => {
  console.error("E2E FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
