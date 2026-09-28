# JO — Cloth, made to be worn out

A full ecommerce store for Jo the cloth maker. Next.js 15 + Firebase, with a WebGL
cloth hero, full customer accounts, and a **bank-transfer checkout with human
receipt verification** (the "SiteZero" flow) — plus an admin studio where Jo runs
everything.

## Quickstart (already wired to the real Firebase project)

The store is connected to the production Firebase project **`jo-studio-2026`**
(project, Firestore, Storage, security rules, admin service account, and catalog
are all live). Local dev talks straight to it:

```bash
npm install
npm run dev           # http://localhost:3000
```

Handy scripts:

```bash
npm run seed          # (re)seed the 14-product catalog + settings into the real project
npm run deploy:rules  # deploy firestore.rules + storage.rules after edits
npm run admin:user    # create/grant Jo's admin account (cherinetyeamlak2@gmail.com)
npm run emulators     # optional: fully local mode (set NEXT_PUBLIC_USE_EMULATORS=1)
```

1. Once Auth is enabled in the console, sign in as **cherinetyeamlak2@gmail.com / JoStudio!2026**
   (or any account granted admin via `npm run admin:user -- you@example.com`).
2. Open `/admin` → **Store settings** → paste Jo's real SiteZero payment link & bank details.
3. **Admin → Lookbook** → upload frames to “add to the album” — they appear on the home
   page and `/lookbook` instantly.
4. Shop, check out, upload a receipt, then verify it in **Admin → Orders & verification**.

## The SiteZero payment flow

```
Checkout → order created (awaiting_payment)
        → customer pays via SiteZero payment link / bank transfer
        → uploads receipt screenshot  (receipt_uploaded)
        → types bank transfer reference → (verifying)
        → Jo reviews receipt + amount in the admin desk
        → Verify  → status=confirmed, stock decremented atomically
        → Reject  → customer re-uploads from their order page
        → Ship → Deliver (with tracking note)
```

The customer watches every status live on `/order/[id]`.

## Where things live

| Path | What |
|---|---|
| `src/app/` | Storefront pages (home, shop, product, cart, checkout, order, account, auth) |
| `src/app/admin/` | Jo's studio: overview, verification desk, products, settings |
| `src/app/api/` | Secure server routes (orders, receipts, admin actions) — all verify ID tokens |
| `src/lib/` | Firebase clients, zustand stores, types, utils |
| `firestore.rules` / `storage.rules` | Security: users see only their orders; receipts owner+admin only |

## Going live (already done ✓)

Project `jo-studio-2026` was created via the REST bridge in this repo:
web app registered, `.env.local` filled, Firestore (eur3) created, rules deployed,
`jo-admin` service account + key minted, catalog seeded. Remaining manual step:
enable **Authentication → Email/Password** in the Firebase console (fresh projects
require one console click to initialize Identity Toolkit).

To run fully local instead: set `NEXT_PUBLIC_USE_EMULATORS=1` in `.env.local`,
`npm run emulators`, `npm run seed -- --emulator`.
