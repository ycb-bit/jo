"use client";

import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Lightweight storefront analytics.
 *
 * Records the funnel events a store owner actually needs to act on:
 *   page_view → view_item → add_to_cart → begin_checkout → receipt_submitted
 *
 * Writes go straight to Firestore under `events`. They are write-only from the
 * client (see firestore.rules) so no visitor can read anyone else's activity,
 * and only admins can read the collection at all.
 *
 * Everything is fire-and-forget: a failed analytics write must never break
 * shopping, so every call swallows its own errors.
 */

export type EventType =
  | "page_view"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "receipt_submitted"
  | "order_created";

/** Dedupe key so a re-render (or React strict mode) cannot double-count. */
let lastEvent: { key: string; at: number } | null = null;

function keyOf(type: string, id: string) {
  return `${type}:${id}`;
}

export function track(
  type: EventType,
  opts: {
    /** Product id, page path, or order id depending on the event. */
    ref?: string;
    name?: string;
    value?: number;
    qty?: number;
  } = {}
) {
  try {
    if (typeof window === "undefined") return;

    const now = Date.now();
    const key = keyOf(type, opts.ref || "");
    // Ignore repeats of the same event within 1s (double-render, double-click).
    if (lastEvent && lastEvent.key === key && now - lastEvent.at < 1000) return;
    lastEvent = { key, at: now };

    void addDoc(collection(db, "events"), {
      type,
      ref: opts.ref || null,
      name: opts.name || null,
      value: typeof opts.value === "number" ? opts.value : null,
      qty: typeof opts.qty === "number" ? opts.qty : null,
      at: now,
    }).catch(() => {
      /* analytics must never surface to the shopper */
    });
  } catch {
    /* ignore */
  }
}

/** Convenience: record a page view for the current route. */
export function trackPageView(path: string) {
  track("page_view", { ref: path });
}
