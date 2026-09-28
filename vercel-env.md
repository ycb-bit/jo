# Vercel Environment Variables

Add these in Vercel: Project → Settings → Environment Variables (Production + Preview).
Copy values from `.env.local` (never commit that file).

| Name | Value from .env.local | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | the apiKey | no |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | the authDomain | no |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `jo-studio-2026` | no |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | the storageBucket | no |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | the messagingSenderId | no |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | the appId | no |
| `FIREBASE_PROJECT_ID` | `jo-studio-2026` | no |
| `FIREBASE_CLIENT_EMAIL` | the `client_email` from `jo-service-account.json` | no |
| `FIREBASE_PRIVATE_KEY` | the `private_key` from `jo-service-account.json` (paste **with** the `-----BEGIN PRIVATE KEY-----\n...` newlines) | **YES** |
| `NEXT_PUBLIC_ADMIN_EMAIL` | `cherinetyeamlak2@gmail.com` | no |

Do NOT add: `FIREBASE_USE_EMULATORS` / `NEXT_PUBLIC_USE_EMULATORS` (must be absent/false in prod).

After first deploy: Vercel Dashboard → your domain → add it under
Firebase Console → Authentication → Settings → Authorized domains.
