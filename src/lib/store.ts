"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { variantKey } from "./utils";
export { useToast } from "@/components/toaster";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  color: string;
  size: string;
  qty: number;
  unitPrice: number;
};

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  remove: (productId: string, color: string, size: string) => void;
  setQty: (productId: string, color: string, size: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((s) => {
          const k = variantKey(line.color, line.size);
          const existing = s.lines.find(
            (l) => l.productId === line.productId && variantKey(l.color, l.size) === k
          );
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.productId === line.productId && variantKey(l.color, l.size) === k
                  ? { ...l, qty: Math.min(l.qty + qty, 9) }
                  : l
              ),
            };
          }
          return { lines: [...s.lines, { ...line, qty }] };
        }),
      remove: (productId, color, size) =>
        set((s) => ({
          lines: s.lines.filter(
            (l) => !(l.productId === productId && variantKey(l.color, l.size) === variantKey(color, size))
          ),
        })),
      setQty: (productId, color, size, qty) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.productId === productId && variantKey(l.color, l.size) === variantKey(color, size)
              ? { ...l, qty: Math.max(1, Math.min(qty, 9)) }
              : l
          ),
        })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((a, l) => a + l.qty, 0),
      subtotal: () => get().lines.reduce((a, l) => a + l.qty * l.unitPrice, 0),
    }),
    { name: "jo-cart" }
  )
);

type WishlistState = {
  productIds: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      toggle: (id) =>
        set((s) => ({
          productIds: s.productIds.includes(id)
            ? s.productIds.filter((p) => p !== id)
            : [...s.productIds, id],
        })),
      has: (id) => get().productIds.includes(id),
    }),
    { name: "jo-wishlist" }
  )
);
