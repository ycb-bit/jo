"use client";

import { db } from "./firebase";
import { collection, doc, onSnapshot, query, where, orderBy, limit as qLimit, type QueryConstraint } from "firebase/firestore";
import type { Product } from "./types";

export function watchProducts(cb: (p: Product[]) => void, opts?: { category?: string; sort?: string }) {
  const constraints: QueryConstraint[] = [where("published", "==", true)];
  if (opts?.category) constraints.push(where("category", "==", opts.category));
  if (opts?.sort === "price-asc") constraints.push(orderBy("price", "asc"));
  if (opts?.sort === "price-desc") constraints.push(orderBy("price", "desc"));
  if (opts?.sort === "new") constraints.push(orderBy("createdAt", "desc"));
  const q = query(collection(db, "products"), ...constraints);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]),
    () => cb([])
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
