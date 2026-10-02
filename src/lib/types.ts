export type Role = "customer" | "admin";

export type Address = {
  /** Stable id so the address book can edit/delete one card by reference. */
  id?: string;
  /** "Home", "Studio", "Mum's place" — shown on the saved-address cards. */
  label?: string;
  /** Pre-selected at checkout. Exactly one address should carry this. */
  isDefault?: boolean;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  /** Ethiopia: woreda / sub-city (Bole, Yeka…) — optional. */
  subCity?: string;
  /** Legacy — no longer collected on the address form. */
  region?: string;
  /** Legacy — not collected anymore (rarely used in Ethiopia). */
  postalCode?: string;
  country: string;
  phone: string;
};

export type VariantStock = Record<string, number>; // key: `${color}|${size}`

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  fabric: string;
  care: string;
  price: number; // major units, e.g. 89.0
  currency: string;
  category: string; // "tops" | "outerwear" | ...
  collection: string;
  images: string[]; // storage paths or data-uris
  colors: string[]; // e.g. ["Bone", "Ink"]
  sizes: string[]; // e.g. ["XS","S","M","L","XL"]
  stock: VariantStock;
  /** Optional per-variant price override, key `${color}|${size}` → price. Falls back to `price`. */
  priceOverrides?: Record<string, number>;
  published: boolean;
  createdAt: number;
};

export type OrderItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  color: string;
  size: string;
  qty: number;
  unitPrice: number;
};

export type OrderStatus =
  | "awaiting_payment"
  | "receipt_uploaded"
  | "verifying"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "rejected"
  | "cancelled";

export type Order = {
  id: string;
  ref?: string;
  userId: string;
  email: string;
  items: OrderItem[];
  subtotal: number;
  /** Legacy orders only — shipping is free storewide now. */
  shipping?: number;
  handlingFee?: number;
  total: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: Address;
  /** How the customer says they paid (chosen at checkout). */
  paymentMethodId?: string;
  paymentMethodName?: string;
  /** Compressed receipt image stored inline as a data URI. */
  receiptData?: string;
  receiptName?: string;
  /** Legacy orders: storage path of the uploaded receipt. */
  receiptUrl?: string;
  receiptRef?: string; // bank reference typed by customer
  rejectionReason?: string;
  trackingNote?: string;
  history: { status: OrderStatus; at: number; note?: string }[];
  createdAt: number;
  updatedAt: number;
};

export type WishlistEntry = {
  productId: string;
  addedAt: number;
};

export type Look = {
  id: string;
  title?: string;
  /** Compressed JPEG data URI (stored straight in Firestore), or legacy storage path. */
  imagePath: string;
  createdAt: number;
};

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: number;
  addresses: Address[];
  wishlist: WishlistEntry[];
};

/** A way to pay, shown to customers at checkout and managed by admin. */
export type PaymentMethod = {
  id: string;
  name: string; // e.g. "CBE", "Wise", "SiteZero payment link"
  type: "bank" | "link";
  accountName?: string;
  accountNumber?: string; // bank account / IBAN
  url?: string; // payment link
  instructions?: string;
};

export type StoreSettings = {
  currency: string;
  /** Extra per-order fee — no longer applied; kept for legacy orders. */
  handlingFee: number;
  /** Checkout payment options, managed in Admin → Settings. */
  paymentMethods: PaymentMethod[];
  /** Shop categories, managed in Admin → Settings. */
  categories: string[];
  announcement: string;
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "awaiting_payment",
  "receipt_uploaded",
  "verifying",
  "confirmed",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  receipt_uploaded: "Receipt uploaded",
  verifying: "Verifying payment",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  rejected: "Receipt rejected",
  cancelled: "Cancelled",
};
