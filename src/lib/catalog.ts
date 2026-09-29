"use client";

import { db } from "./firebase";
import { collection, doc, onSnapshot, query, where, orderBy, limit as qLimit } from "firebase/firestore";
import type { Product } from "./types";

/**
 * Sorts in the browser on purpose.
 *
 * Firestore would need a composite index for every combination of
 * (published, category, sort field), and a missing index makes the whole
 * listener fail with FAILED_PRECONDITION — the store renders as an empty
 * rack with no clue why. The catalog is small, so we ask for one flat
 * query on the auto-indexed `published` field and sort locally.
 */
function sortProducts(products: Product[], sort?: string) {
  const list = [...products];
  if (sort === "price-asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sort === "price-desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
  else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

export function watchProducts(
  cb: (p: Product[]) => void,
  opts?: { category?: string; sort?: string },
  onError?: (err: Error) => void
) {
  const q = query(collection(db, "products"), where("published", "==", true));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
      const filtered = opts?.category ? all.filter((p) => p.category === opts.category) : all;
      cb(sortProducts(filtered, opts?.sort));
    },
    (err) => {
      // Surface it. Silently returning [] looked like an empty store.
      console.error("[catalog] product listener failed:", err);
      onError?.(err);
    }
  );
}

export function watchProduct(slug: string, cb: (p: Product | null) => void) {
  const q = query(collection(db, "products"), where("slug", "==", slug), qLimit(1));
  return onSnapshot(
    q,
    (snap) => cb(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Product)),
    () => cb(null)
  );
}

export function watchProductById(id: string, cb: (p: Product | null) => void) {
  return onSnapshot(
    doc(db, "products", id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null),
    () => cb(null)
  );
}
